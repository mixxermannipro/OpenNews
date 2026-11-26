import { isDiagnostic } from './diagnosticEvents.ts';
import { slimFeedArticle } from './feedRefresh.ts';
import {
  hasPaywallMarkup,
  hasRobotsNoArchiveOrNoAi,
  isPublisherOptedOut,
  OPENNEWS_USER_AGENT,
} from './publisherPolicy.ts';
import { isSafeHttpUrl } from './publicHttpUrl.ts';
import { parseFeedPayload, repairTruncatedFeedXml } from './rssParser.ts';
import { ensureWavBytes } from './ttsClient.ts';
import type { NewsArticle, NewsSource } from '../types/news.ts';

export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export const MAX_TRANSCRIPT_BYTES = 512 * 1024;
export const MAX_TTS_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 128 * 1024;
export const MAX_AI_PROMPT_CHARS = 60_000;
export const MAX_AI_MODEL_CHARS = 120;
export const SAFE_MODEL_RE = /^[A-Za-z0-9._:/-]+$/;

export const RATE_LIMIT_GENERAL = { windowMs: 60_000, limit: 65 } as const;
export const RATE_LIMIT_AI = { windowMs: 60_000, limit: 10 } as const;
export const RATE_LIMIT_TTS = { windowMs: 60_000, limit: 20 } as const;

export interface ExtractedArticlePayload {
  paragraphs: string[];
  headingIndexes: number[];
  ogImage?: string;
  unavailable?: boolean;
  blockedWall?: boolean;
  optOut?: boolean;
}

export interface ApiResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
  kind: 'json' | 'text' | 'bytes' | 'empty';
}

export interface ApiRuntimeDeps {
  fetchPublic: (url: string, init?: RequestInit) => Promise<Response>;
  readPublicText: (
    response: Response,
    maxBytes?: number,
    options?: { truncateOnLimit?: boolean },
  ) => Promise<string>;
  extractArticle?: (
    response: Response,
    finalUrl: string,
    articleTitle?: string,
  ) => Promise<ExtractedArticlePayload>;
  diagnosticsEnabled?: boolean;
  optOutDomainsCsv?: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): Promise<RateLimitDecision> | RateLimitDecision;
}

export function createSlidingWindowLimiter(options: {
  windowMs: number;
  limit: number;
  maxKeys?: number;
}): RateLimiter {
  const { windowMs, limit, maxKeys = 5000 } = options;
  const buckets = new Map<string, number[]>();

  return {
    check(rawKey: string, now = Date.now()): RateLimitDecision {
      const key = rawKey || 'anonymous';
      const cutoff = now - windowMs;
      const existing = buckets.get(key) ?? [];
      const active = existing.filter((ts) => ts > cutoff);

      if (active.length >= limit) {
        const oldest = active[0] ?? now;
        const resetMs = Math.max(1000, oldest + windowMs - now);
        buckets.delete(key);
        buckets.set(key, active);
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetSeconds: Math.ceil(resetMs / 1000),
        };
      }

      active.push(now);
      buckets.delete(key);
      buckets.set(key, active);
      while (buckets.size > maxKeys) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey === undefined) break;
        buckets.delete(oldestKey);
      }

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - active.length),
        resetSeconds: Math.ceil(windowMs / 1000),
      };
    },
  };
}

export function redactSecrets(input: string): string {
  if (!input) return '';
  return input
    .replace(/\bAIza[A-Za-z0-9_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bsk-(?:proj-|ant-|or-|live-|test-)?[A-Za-z0-9_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bmistral-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._:/+=-]{8,}/gi, 'Bearer [REDACTED]');
}

function readHeaderValue(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
): string {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? '';
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
  }
  return '';
}

/**
 * Enforces Same-Origin protection on `/api/*`.
 * - `/api/health` is public unless an explicit foreign `Origin` is sent.
 * - All other endpoints require a matching `Origin` OR `Sec-Fetch-Site: same-origin`
 *   (when no `Origin` header is present, e.g. same-origin GET requests in browsers).
 */
export function checkApiOrigin(
  headers: Headers | Record<string, string | string[] | undefined>,
  requestUrl: string,
  configuredOrigin?: string,
  pathnameOverride?: string,
): { status: 403; error: string } | null {
  const parsedUrl = new URL(requestUrl);
  const pathname = pathnameOverride ?? parsedUrl.pathname;
  const origin = readHeaderValue(headers, 'origin').trim();
  const site = readHeaderValue(headers, 'sec-fetch-site').trim().toLowerCase();
  const expected = (configuredOrigin || parsedUrl.origin).trim();

  if (pathname === '/api/health') {
    if (origin && origin !== expected && (configuredOrigin || site !== 'same-origin')) {
      return { status: 403, error: 'Diese Herkunft ist nicht erlaubt.' };
    }
    return null;
  }

  if (origin) {
    if (origin === expected) return null;
    if (!configuredOrigin && site === 'same-origin') return null;
    return { status: 403, error: 'Diese Herkunft ist nicht erlaubt.' };
  }

  if (site === 'same-origin') {
    return null;
  }

  return { status: 403, error: 'Diese Herkunft ist nicht erlaubt.' };
}

export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(decision.remaining),
    'RateLimit-Reset': String(decision.resetSeconds),
    ...(decision.allowed ? {} : { 'Retry-After': String(decision.resetSeconds) }),
  };
}

const SENSITIVE_REDIRECT_HEADERS = [
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-goog-api-key',
  'xi-api-key',
  'cookie',
];

export function sanitizeRedirectHeaders(
  headers: HeadersInit | undefined,
  fromUrl: string,
  toUrl: string,
): Headers {
  const next = new Headers(headers);
  try {
    if (new URL(fromUrl).origin !== new URL(toUrl).origin) {
      for (const name of SENSITIVE_REDIRECT_HEADERS) {
        next.delete(name);
      }
    }
  } catch {
    for (const name of SENSITIVE_REDIRECT_HEADERS) {
      next.delete(name);
    }
  }
  return next;
}

export async function fetchPublicWithRedirects(
  rawUrl: string,
  options: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let url = rawUrl;
  let requestHeaders = new Headers(options.headers);
  const signal = options.signal ?? AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSafeHttpUrl(url)) throw new Error('Invalid public URL');
    const response = await fetchImpl(url, {
      ...options,
      headers: requestHeaders,
      redirect: 'manual',
      signal,
    });
    const location = response.headers.get('location');
    if (options.method === 'POST' || !location || ![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    await response.body?.cancel();
    const nextUrl = new URL(location, url).href;
    requestHeaders = sanitizeRedirectHeaders(requestHeaders, url, nextUrl);
    url = nextUrl;
  }
  throw new Error('Too many redirects');
}

function detectCharset(bytes: Uint8Array, contentType?: string | null): string {
  const headerMatch = contentType?.match(/charset\s*=\s*["']?([^"'\s;]+)/i);
  if (headerMatch?.[1]) return headerMatch[1].trim().toLowerCase();
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const xmlMatch = head.match(/<\?xml[^>]+encoding\s*=\s*["']([^"']+)["']/i);
  if (xmlMatch?.[1]) return xmlMatch[1].trim().toLowerCase();
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s/>;]+)/i);
  if (metaCharset?.[1]) return metaCharset[1].trim().toLowerCase();
  return 'utf-8';
}

export async function readPublicTextFromResponse(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES,
  options: { truncateOnLimit?: boolean } = {},
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (bytes + value.byteLength > maxBytes) {
        if (options.truncateOnLimit) {
          const remaining = maxBytes - bytes;
          if (remaining > 0) {
            chunks.push(value.subarray(0, remaining));
            bytes += remaining;
          }
          break;
        }
        throw new Error('Response exceeds size limit');
      }
      bytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const charset = detectCharset(combined, response.headers.get('content-type'));
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(combined);
    } catch {
      // Fallback to UTF-8
    }
  }
  return new TextDecoder('utf-8').decode(combined);
}

export async function readAudioBytesLimited(
  response: Response,
  maxBytes = MAX_TTS_BYTES,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (bytes + value.byteLength > maxBytes) {
        throw new Error('Audio response exceeds size limit');
      }
      bytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function safeParseJson<T extends Record<string, unknown>>(
  resp: Response,
  readText: ApiRuntimeDeps['readPublicText'],
): Promise<T> {
  const raw = await readText(resp);
  if (!raw.trim()) return {} as T;
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
  } catch {
    return {
      error: {
        message: redactSecrets(raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)),
      },
    } as unknown as T;
  }
}

export function handleDiagnosticsPost(body: Record<string, unknown> | null, enabled: boolean): ApiResult {
  if (!enabled) return { status: 404, body: null, kind: 'empty' };
  if (!body || !isDiagnostic(body.event) || Object.keys(body).length !== 1) {
    return { status: 400, body: null, kind: 'empty' };
  }
  console.info(JSON.stringify({ event: body.event, hour: Math.floor(Date.now() / 3_600_000) }));
  return { status: 204, body: null, kind: 'empty' };
}

export async function handleFeedsFetch(
  body: Record<string, unknown> | null,
  deps: ApiRuntimeDeps,
  options: {
    onSourceResult?: (source: NewsSource, response: Response, articles: NewsArticle[]) => void;
    getCached?: (source: NewsSource) => NewsArticle[] | undefined;
  } = {},
): Promise<ApiResult> {
  const feeds = Array.isArray(body?.feeds) ? (body.feeds as NewsSource[]) : [];
  if (feeds.length === 0) {
    return { status: 200, body: { articles: [], feedStatuses: [] }, kind: 'json' };
  }

  const limitedFeeds = feeds.slice(0, 20);
  const results = await Promise.all(
    limitedFeeds.map(async (source) => {
      if (
        !source
        || typeof source !== 'object'
        || typeof source.id !== 'string'
        || typeof source.url !== 'string'
        || !isSafeHttpUrl(source.url)
      ) {
        return {
          sourceId: typeof source?.id === 'string' ? source.id : 'unknown',
          ok: false,
          count: 0,
          articles: [] as NewsArticle[],
        };
      }
      const cached = options.getCached?.(source);
      if (cached) {
        return { sourceId: source.id, ok: true, count: cached.length, articles: cached };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      try {
        const response = await deps.fetchPublic(source.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': OPENNEWS_USER_AGENT,
            Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        if (!response.ok) {
          await response.body?.cancel();
          return { sourceId: source.id, ok: false, count: 0, articles: [] as NewsArticle[] };
        }
        const rawText = repairTruncatedFeedXml(
          await deps.readPublicText(response, 1_800_000, { truncateOnLimit: true }),
        );
        const articles = parseFeedPayload(rawText, source).map(slimFeedArticle);
        options.onSourceResult?.(source, response, articles);
        return { sourceId: source.id, ok: true, count: articles.length, articles };
      } catch {
        return { sourceId: source.id, ok: false, count: 0, articles: [] as NewsArticle[] };
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  const allArticles = results.flatMap((r) => r.articles);
  const feedStatuses = results.map(({ sourceId, ok, count }) => ({ sourceId, ok, count }));
  return {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
    body: { articles: allArticles, feedStatuses },
    kind: 'json',
  };
}

export async function handleFeedsDiscover(rawQueryInput: string, deps: ApiRuntimeDeps): Promise<ApiResult> {
  const rawQuery = rawQueryInput.trim();
  if (!rawQuery) return { status: 200, body: { discovered: [] }, kind: 'json' };

  const looksLikeUrlOrDomain =
    /^https?:\/\//i.test(rawQuery) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(rawQuery);
  if (!looksLikeUrlOrDomain) return { status: 200, body: { discovered: [] }, kind: 'json' };

  const normalizedUrl = /^https?:\/\//i.test(rawQuery) ? rawQuery : `https://${rawQuery}`;
  if (!isSafeHttpUrl(normalizedUrl)) return { status: 200, body: { discovered: [] }, kind: 'json' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await deps.fetchPublic(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': OPENNEWS_USER_AGENT,
        Accept: 'text/html,application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml',
      },
    });
    if (!resp.ok) {
      await resp.body?.cancel();
      return { status: 200, body: { discovered: [] }, kind: 'json' };
    }

    const contentType = resp.headers.get('content-type') || '';
    const body = await deps.readPublicText(resp);
    const discovered: Array<{ name: string; url: string; format: 'rss' | 'atom' | 'json' }> = [];

    if (/xml|rss|atom|json/i.test(contentType) || body.trim().startsWith('<rss') || body.trim().startsWith('<feed')) {
      const hostName = new URL(normalizedUrl).hostname.replace(/^www\./, '');
      const fmt = contentType.includes('json') ? 'json' : body.includes('<feed') ? 'atom' : 'rss';
      discovered.push({ name: hostName, url: normalizedUrl, format: fmt });
    } else {
      const linkTags = [...body.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)];
      const baseOrigin = new URL(normalizedUrl).origin;
      const hostLabel = new URL(normalizedUrl).hostname.replace(/^www\./, '');
      for (const match of linkTags) {
        const tag = match[0];
        const typeMatch = tag.match(/type=["']([^"']+)["']/i);
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        const titleMatch = tag.match(/title=["']([^"']+)["']/i);
        const type = typeMatch?.[1] || '';
        const href = hrefMatch?.[1] || '';
        if (!href || !/(rss|atom|xml|feed\+json)/i.test(type)) continue;
        let absUrl: string;
        try {
          absUrl = href.startsWith('http') ? href : new URL(href, baseOrigin).toString();
        } catch {
          continue;
        }
        if (!isSafeHttpUrl(absUrl)) continue;
        const format = type.includes('json') ? 'json' : type.includes('atom') ? 'atom' : 'rss';
        discovered.push({
          name: titleMatch?.[1]?.trim() || hostLabel,
          url: absUrl,
          format,
        });
      }
    }

    const unique = discovered.filter(
      (item, idx, arr) => arr.findIndex((x) => x.url === item.url) === idx,
    );
    return { status: 200, body: { discovered: unique.slice(0, 6) }, kind: 'json' };
  } catch {
    return { status: 200, body: { discovered: [] }, kind: 'json' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleMediaTranscript(targetUrl: string, deps: ApiRuntimeDeps): Promise<ApiResult> {
  if (!targetUrl.startsWith('https://') || !isSafeHttpUrl(targetUrl)) {
    return { status: 400, body: null, kind: 'empty' };
  }
  try {
    const response = await deps.fetchPublic(targetUrl, { signal: AbortSignal.timeout(6000) });
    const type = response.headers.get('content-type') || '';
    const finalUrl = response.url || targetUrl;
    if (
      !response.ok
      || !finalUrl.startsWith('https://')
      || !/^(text\/(vtt|plain)|application\/(x-subrip|octet-stream))(;|$)/i.test(type)
    ) {
      await response.body?.cancel();
      return { status: 502, body: null, kind: 'empty' };
    }
    const text = await deps.readPublicText(response, MAX_TRANSCRIPT_BYTES);
    return {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: text,
      kind: 'text',
    };
  } catch {
    return { status: 502, body: null, kind: 'empty' };
  }
}

export async function handleArticleExtract(
  targetUrl: string,
  articleTitle: string | undefined,
  deps: ApiRuntimeDeps,
): Promise<ApiResult> {
  if (!isSafeHttpUrl(targetUrl)) {
    return { status: 400, headers: { 'Cache-Control': 'no-store' }, body: { error: 'Ungültige Artikel-URL' }, kind: 'json' };
  }
  if (isPublisherOptedOut(targetUrl, deps.optOutDomainsCsv)) {
    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: { paragraphs: [], headingIndexes: [], unavailable: true, optOut: true },
      kind: 'json',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await deps.fetchPublic(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': OPENNEWS_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok || (contentType && !/^(?:text\/(?:html|plain)|application\/xhtml\+xml)\b/i.test(contentType))) {
      await resp.body?.cancel();
      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: { paragraphs: [], headingIndexes: [], unavailable: true },
        kind: 'json',
      };
    }
    if (hasRobotsNoArchiveOrNoAi(resp.headers, '')) {
      await resp.body?.cancel();
      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: { paragraphs: [], headingIndexes: [], unavailable: true },
        kind: 'json',
      };
    }

    const finalUrl = resp.url || targetUrl;
    if (deps.extractArticle) {
      const extracted = await deps.extractArticle(resp, finalUrl, articleTitle);
      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: extracted,
        kind: 'json',
      };
    }

    const rawHtml = await deps.readPublicText(resp, 2 * 1024 * 1024);
    if (hasRobotsNoArchiveOrNoAi(resp.headers, rawHtml)) {
      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: { paragraphs: [], headingIndexes: [], unavailable: true },
        kind: 'json',
      };
    }
    if (hasPaywallMarkup(rawHtml)) {
      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: { paragraphs: [], headingIndexes: [], unavailable: true, blockedWall: true },
        kind: 'json',
      };
    }

    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: { paragraphs: [], headingIndexes: [] },
      kind: 'json',
    };
  } catch {
    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: { paragraphs: [], headingIndexes: [], unavailable: true },
      kind: 'json',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleAiProxy(
  body: Record<string, unknown> | null,
  deps: ApiRuntimeDeps,
): Promise<ApiResult> {
  const provider = String(body?.provider || 'google');
  const apiKey = String(body?.apiKey || '').trim();
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const customEndpoint = String(body?.customEndpoint || '').trim();
  const noStore = { 'Cache-Control': 'no-store' };

  if (!prompt || !model) {
    return { status: 400, headers: noStore, body: { error: 'Modell oder Prompt fehlt.' }, kind: 'json' };
  }
  if (prompt.length > MAX_AI_PROMPT_CHARS) {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Der Prompt überschreitet die maximal erlaubte Länge.' },
      kind: 'json',
    };
  }
  if (model.length > MAX_AI_MODEL_CHARS || !SAFE_MODEL_RE.test(model)) {
    return { status: 400, headers: noStore, body: { error: 'Ungültiger Modellname.' }, kind: 'json' };
  }
  if (!apiKey) {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Bitte hinterlege deinen API-Key in den Einstellungen.' },
      kind: 'json',
    };
  }
  if (!['google', 'anthropic', 'openai', 'mistral', 'custom'].includes(provider)) {
    return { status: 400, headers: noStore, body: { error: 'Unbekannter KI-Anbieter.' }, kind: 'json' };
  }
  if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Der eigene KI-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' },
      kind: 'json',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    if (provider === 'google') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await deps.fetchPublic(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });
      const json = await safeParseJson<{
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }>(resp, deps.readPublicText);
      if (!resp.ok) {
        return {
          status: resp.status,
          headers: noStore,
          body: { error: redactSecrets(json.error?.message || 'Google AI Studio Fehler') },
          kind: 'json',
        };
      }
      return {
        status: 200,
        headers: noStore,
        body: { text: json.candidates?.[0]?.content?.parts?.[0]?.text || '' },
        kind: 'json',
      };
    }

    if (provider === 'anthropic') {
      const resp = await deps.fetchPublic('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const json = await safeParseJson<{
        error?: { message?: string };
        content?: Array<{ text?: string }>;
      }>(resp, deps.readPublicText);
      if (!resp.ok) {
        return {
          status: resp.status,
          headers: noStore,
          body: { error: redactSecrets(json.error?.message || 'Anthropic Fehler') },
          kind: 'json',
        };
      }
      return {
        status: 200,
        headers: noStore,
        body: { text: json.content?.[0]?.text || '' },
        kind: 'json',
      };
    }

    const endpoint =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : provider === 'mistral'
          ? 'https://api.mistral.ai/v1/chat/completions'
          : customEndpoint;

    const resp = await deps.fetchPublic(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });
    const json = await safeParseJson<{
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    }>(resp, deps.readPublicText);
    if (!resp.ok) {
      return {
        status: resp.status,
        headers: noStore,
        body: { error: redactSecrets(json.error?.message || 'KI-Provider Fehler') },
        kind: 'json',
      };
    }
    return {
      status: 200,
      headers: noStore,
      body: { text: json.choices?.[0]?.message?.content || '' },
      kind: 'json',
    };
  } catch {
    return {
      status: 502,
      headers: noStore,
      body: { error: 'Verbindung zum KI-Anbieter fehlgeschlagen' },
      kind: 'json',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleTtsProxy(
  body: Record<string, unknown> | null,
  deps: ApiRuntimeDeps,
): Promise<ApiResult> {
  const provider = String(body?.provider || 'google');
  const apiKey = String(body?.apiKey || '').trim();
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  const voice = typeof body?.voice === 'string' ? body.voice.trim() : '';
  const stylePrompt = typeof body?.stylePrompt === 'string' ? body.stylePrompt.trim().slice(0, 300) : '';
  const customEndpoint = String(body?.customEndpoint || '').trim();
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  const rawSpeed = Number(body?.speed);
  const speed = Number.isFinite(rawSpeed) ? Math.max(0.75, Math.min(1.6, rawSpeed)) : 1;
  const noStore = { 'Cache-Control': 'no-store' };

  if (!text || text.length > 3000) {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Der Vorlesetext fehlt oder ist zu lang (max. 3.000 Zeichen).' },
      kind: 'json',
    };
  }
  if (!['google', 'openai', 'elevenlabs', 'custom'].includes(provider)) {
    return { status: 400, headers: noStore, body: { error: 'Unbekannter Vorlese-Anbieter.' }, kind: 'json' };
  }
  if (model && (model.length > 120 || !SAFE_MODEL_RE.test(model))) {
    return { status: 400, headers: noStore, body: { error: 'Ungültiges TTS-Modell.' }, kind: 'json' };
  }
  if (!apiKey && provider !== 'custom') {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Bitte hinterlege einen API-Key für den gewählten Vorlese-Anbieter.' },
      kind: 'json',
    };
  }
  if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
    return {
      status: 400,
      headers: noStore,
      body: { error: 'Der eigene TTS-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' },
      kind: 'json',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    if (provider === 'google') {
      const targetModel = (model || 'gemini-3.8-flash-lite-tts').replace(/^models\//, '');
      const voiceName = /^[A-Za-z0-9_-]{2,40}$/.test(voice) ? voice : 'Kore';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
      const promptText = stylePrompt ? `${stylePrompt}\n\n${text}` : text;
      const resp = await deps.fetchPublic(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        }),
      });
      if (!resp.ok) {
        await resp.body?.cancel();
        const msg =
          resp.status === 401 || resp.status === 403
            ? 'API-Key ungültig oder ohne Berechtigung.'
            : resp.status === 429
              ? 'Anbieter-Kontingent erreicht (429). Bitte später erneut versuchen.'
              : `Google TTS Fehler (${resp.status})`;
        return { status: resp.status, headers: noStore, body: { error: msg }, kind: 'json' };
      }
      const raw = await deps.readPublicText(resp);
      const parsed = JSON.parse(raw) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
      };
      const base64Audio = parsed.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return {
          status: 502,
          headers: noStore,
          body: { error: 'Google AI Studio hat keine Audiodaten zurückgegeben.' },
          kind: 'json',
        };
      }
      const wavBytes = ensureWavBytes(base64ToUint8Array(base64Audio), 24000);
      return {
        status: 200,
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
        body: wavBytes,
        kind: 'bytes',
      };
    }

    if (provider === 'elevenlabs') {
      const safeVoice = /^[A-Za-z0-9_-]{8,64}$/.test(voice) ? voice : '21m00Tcm4TlvDq8ikWAM';
      const resp = await deps.fetchPublic(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoice)}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: model || 'eleven_flash_v2_5',
          }),
        },
      );
      if (!resp.ok) {
        await resp.body?.cancel();
        return {
          status: resp.status,
          headers: noStore,
          body: { error: `ElevenLabs Fehler (${resp.status})` },
          kind: 'json',
        };
      }
      const audio = await readAudioBytesLimited(resp);
      return {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
        body: audio,
        kind: 'bytes',
      };
    }

    const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/audio/speech' : customEndpoint;
    const targetModel = model || (provider === 'openai' ? 'gpt-4o-mini-tts' : 'tts-1');
    const resp = await deps.fetchPublic(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: targetModel,
        input: text,
        voice: voice || 'sage',
        speed,
        ...(stylePrompt && targetModel === 'gpt-4o-mini-tts' ? { instructions: stylePrompt } : {}),
        response_format: 'mp3',
      }),
    });
    if (!resp.ok) {
      await resp.body?.cancel();
      const msg =
        resp.status === 401 || resp.status === 403
          ? 'API-Key ungültig oder ohne Berechtigung.'
          : resp.status === 429
            ? 'Anbieter-Kontingent erreicht (429). Bitte später erneut versuchen.'
            : `TTS-Anbieter Fehler (${resp.status})`;
      return { status: resp.status, headers: noStore, body: { error: msg }, kind: 'json' };
    }
    const contentType = resp.headers.get('content-type') || 'audio/mpeg';
    const audio = await readAudioBytesLimited(resp);
    return {
      status: 200,
      headers: {
        'Content-Type': /^audio\//i.test(contentType) ? contentType : 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
      body: audio,
      kind: 'bytes',
    };
  } catch {
    return {
      status: 502,
      headers: noStore,
      body: { error: 'Sprachausgabe beim Anbieter fehlgeschlagen.' },
      kind: 'json',
    };
  } finally {
    clearTimeout(timeout);
  }
}
