import { isDiagnostic } from './diagnosticEvents.ts';
import { isSafeHttpUrl } from './publicHttpUrl.ts';
import { parseFeedPayload, repairTruncatedFeedXml } from './rssParser.ts';
import { ensureWavBytes } from './ttsClient.ts';
import type { NewsSource } from '../types/news.ts';

export interface PagesApiEnv {
  OPENNEWS_DIAGNOSTICS?: string;
  OPENNEWS_ORIGIN?: string;
}

export interface ExtractedArticlePayload {
  paragraphs: string[];
  headingIndexes: number[];
  ogImage?: string;
  unavailable?: boolean;
  blockedWall?: boolean;
}

export interface PagesApiDeps {
  fetchImpl?: typeof fetch;
  extractArticle?: (response: Response, finalUrl: string, articleTitle?: string) => Promise<ExtractedArticlePayload>;
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 512 * 1024;
const MAX_TTS_BYTES = 10 * 1024 * 1024;

async function readAudioBytesLimited(response: Response, maxBytes = MAX_TTS_BYTES): Promise<Uint8Array> {
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

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

const SENSITIVE_REDIRECT_HEADERS = [
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-goog-api-key',
  'xi-api-key',
  'cookie',
];

function sanitizeRedirectHeaders(headers: HeadersInit | undefined, fromUrl: string, toUrl: string): Headers {
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

async function fetchPublic(
  rawUrl: string,
  options: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let url = rawUrl;
  let requestHeaders = new Headers(options.headers);
  const signal = options.signal ?? AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSafeHttpUrl(url)) throw new Error('Invalid public URL');
    const response = await fetchImpl(url, { ...options, headers: requestHeaders, redirect: 'manual', signal });
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

async function readPublicText(
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

async function readJsonBody(request: Request, maxBytes = 128 * 1024): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function checkOrigin(request: Request, env: PagesApiEnv): Response | null {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const expected = env.OPENNEWS_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== expected && (env.OPENNEWS_ORIGIN || site !== 'same-origin')) {
    return jsonResponse({ error: 'Diese Herkunft ist nicht erlaubt.' }, 403);
  }
  return null;
}

/**
 * Handles all `/api/*` requests for OpenNews on Cloudflare Pages Functions.
 */
export async function handlePagesApiRequest(
  request: Request,
  env: PagesApiEnv = {},
  deps: PagesApiDeps = {},
): Promise<Response> {
  const originError = checkOrigin(request, env);
  if (originError) return originError;

  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/health' && method === 'GET') {
    return jsonResponse({ ok: true, service: 'OpenNews', runtime: 'cloudflare-pages' });
  }

  if (path === '/api/diagnostics' && method === 'GET') {
    return jsonResponse(
      { enabled: env.OPENNEWS_DIAGNOSTICS === '1' },
      200,
      { 'Cache-Control': 'no-store' },
    );
  }

  if (path === '/api/diagnostics' && method === 'POST') {
    if (env.OPENNEWS_DIAGNOSTICS !== '1') return new Response(null, { status: 404 });
    const body = await readJsonBody(request);
    if (!body || !isDiagnostic(body.event) || Object.keys(body).length !== 1) {
      return new Response(null, { status: 400 });
    }
    console.info(JSON.stringify({ event: body.event, hour: Math.floor(Date.now() / 3_600_000) }));
    return new Response(null, { status: 204 });
  }

  if (path === '/api/feeds/fetch' && method === 'POST') {
    const body = await readJsonBody(request);
    const feeds = Array.isArray(body?.feeds) ? (body.feeds as NewsSource[]) : [];
    if (feeds.length === 0) {
      return jsonResponse({ articles: [], feedStatuses: [] });
    }

    const limitedFeeds = feeds.slice(0, 20);
    const results = await Promise.all(
      limitedFeeds.map(async (source) => {
        if (!source?.url || !isSafeHttpUrl(source.url)) {
          return { sourceId: source?.id || 'unknown', ok: false, count: 0, articles: [] };
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5500);
        try {
          const response = await fetchPublic(
            source.url,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': 'OpenNews/1.0 (+https://opennews-app.pages.dev; RSS Reader)',
                Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*',
              },
            },
            fetchImpl,
          );
          if (!response.ok) {
            await response.body?.cancel();
            return { sourceId: source.id, ok: false, count: 0, status: response.status, articles: [] };
          }
          const rawText = repairTruncatedFeedXml(
            await readPublicText(response, 1_800_000, { truncateOnLimit: true }),
          );
          const articles = parseFeedPayload(rawText, source);
          return { sourceId: source.id, ok: true, count: articles.length, articles };
        } catch {
          return { sourceId: source.id, ok: false, count: 0, articles: [] };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    const allArticles = results.flatMap((r) => r.articles);
    const feedStatuses = results.map(({ sourceId, ok, count }) => ({ sourceId, ok, count }));
    return jsonResponse({ articles: allArticles, feedStatuses }, 200, { 'Cache-Control': 'no-store' });
  }

  if (path === '/api/feeds/discover' && method === 'GET') {
    const rawQuery = String(url.searchParams.get('q') || '').trim();
    if (!rawQuery) return jsonResponse({ discovered: [] });

    const looksLikeUrlOrDomain =
      /^https?:\/\//i.test(rawQuery) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(rawQuery);
    if (!looksLikeUrlOrDomain) return jsonResponse({ discovered: [] });

    const normalizedUrl = /^https?:\/\//i.test(rawQuery) ? rawQuery : `https://${rawQuery}`;
    if (!isSafeHttpUrl(normalizedUrl)) return jsonResponse({ discovered: [] });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetchPublic(
        normalizedUrl,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'OpenNews/1.0 (+https://opennews-app.pages.dev)',
            Accept: 'text/html,application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml',
          },
        },
        fetchImpl,
      );
      if (!resp.ok) {
        await resp.body?.cancel();
        return jsonResponse({ discovered: [] });
      }

      const contentType = resp.headers.get('content-type') || '';
      const body = await readPublicText(resp);
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
      return jsonResponse({ discovered: unique.slice(0, 6) });
    } catch {
      return jsonResponse({ discovered: [] });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (path === '/api/media/transcript' && method === 'GET') {
    const targetUrl = url.searchParams.get('url') || '';
    if (!targetUrl.startsWith('https://') || !isSafeHttpUrl(targetUrl)) {
      return new Response(null, { status: 400 });
    }
    try {
      const response = await fetchPublic(targetUrl, { signal: AbortSignal.timeout(6000) }, fetchImpl);
      const type = response.headers.get('content-type') || '';
      const finalUrl = response.url || targetUrl;
      if (
        !response.ok ||
        !finalUrl.startsWith('https://') ||
        !/^(text\/(vtt|plain)|application\/(x-subrip|octet-stream))(;|$)/i.test(type)
      ) {
        await response.body?.cancel();
        return new Response(null, { status: 502 });
      }
      const text = await readPublicText(response, MAX_TRANSCRIPT_BYTES);
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response(null, { status: 502 });
    }
  }

  if (path === '/api/article/extract' && method === 'GET') {
    const targetUrl = String(url.searchParams.get('url') || '');
    if (!isSafeHttpUrl(targetUrl)) {
      return jsonResponse({ error: 'Ungültige Artikel-URL' }, 400);
    }
    const articleTitle = String(url.searchParams.get('title') || '').trim().slice(0, 300) || undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const resp = await fetchPublic(
        targetUrl,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        },
        fetchImpl,
      );
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || (contentType && !/^(?:text\/(?:html|plain)|application\/xhtml\+xml)\b/i.test(contentType))) {
        await resp.body?.cancel();
        return jsonResponse({ paragraphs: [], headingIndexes: [], unavailable: true }, 200, {
          'Cache-Control': 'no-store',
        });
      }
      const finalUrl = resp.url || targetUrl;
      const extracted = deps.extractArticle
        ? await deps.extractArticle(resp, finalUrl, articleTitle)
        : { paragraphs: [], headingIndexes: [] };
      return jsonResponse(extracted, 200, { 'Cache-Control': 'no-store' });
    } catch {
      return jsonResponse({ paragraphs: [], headingIndexes: [], unavailable: true }, 200, {
        'Cache-Control': 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (path === '/api/ai/proxy' && method === 'POST') {
    const body = await readJsonBody(request);
    const provider = String(body?.provider || 'google');
    const apiKey = String(body?.apiKey || '').trim();
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const customEndpoint = String(body?.customEndpoint || '').trim();

    if (!prompt || !model) {
      return jsonResponse({ error: 'Modell oder Prompt fehlt.' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (prompt.length > 60_000) {
      return jsonResponse({ error: 'Der Prompt überschreitet die maximal erlaubte Länge.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (model.length > 120 || !/^[A-Za-z0-9._:/-]+$/.test(model)) {
      return jsonResponse({ error: 'Ungültiger Modellname.' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!apiKey) {
      return jsonResponse({ error: 'Bitte hinterlege deinen API-Key in den Einstellungen.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (!['google', 'anthropic', 'openai', 'mistral', 'custom'].includes(provider)) {
      return jsonResponse({ error: 'Unbekannter KI-Anbieter.' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
      return jsonResponse({ error: 'Der eigene KI-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const safeParseJson = async <T extends Record<string, unknown>>(resp: Response): Promise<T> => {
      const raw = await readPublicText(resp);
      if (!raw.trim()) return {} as T;
      try {
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
      } catch {
        return { error: { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) } } as unknown as T;
      }
    };

    try {
      if (provider === 'google') {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const resp = await fetchPublic(
          apiUrl,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3 },
            }),
          },
          fetchImpl,
        );
        const json = await safeParseJson<{
          error?: { message?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        }>(resp);
        if (!resp.ok) {
          return jsonResponse({ error: json.error?.message || 'Google AI Studio Fehler' }, resp.status, {
            'Cache-Control': 'no-store',
          });
        }
        return jsonResponse({ text: json.candidates?.[0]?.content?.parts?.[0]?.text || '' }, 200, {
          'Cache-Control': 'no-store',
        });
      }

      if (provider === 'anthropic') {
        const resp = await fetchPublic(
          'https://api.anthropic.com/v1/messages',
          {
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
          },
          fetchImpl,
        );
        const json = await safeParseJson<{
          error?: { message?: string };
          content?: Array<{ text?: string }>;
        }>(resp);
        if (!resp.ok) {
          return jsonResponse({ error: json.error?.message || 'Anthropic Fehler' }, resp.status, {
            'Cache-Control': 'no-store',
          });
        }
        return jsonResponse({ text: json.content?.[0]?.text || '' }, 200, { 'Cache-Control': 'no-store' });
      }

      const endpoint =
        provider === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : provider === 'mistral'
            ? 'https://api.mistral.ai/v1/chat/completions'
            : customEndpoint;

      const resp = await fetchPublic(
        endpoint,
        {
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
        },
        fetchImpl,
      );
      const json = await safeParseJson<{
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      }>(resp);
      if (!resp.ok) {
        return jsonResponse({ error: json.error?.message || 'KI-Provider Fehler' }, resp.status, {
          'Cache-Control': 'no-store',
        });
      }
      return jsonResponse({ text: json.choices?.[0]?.message?.content || '' }, 200, {
        'Cache-Control': 'no-store',
      });
    } catch {
      return jsonResponse({ error: 'Verbindung zum KI-Anbieter fehlgeschlagen' }, 502, {
        'Cache-Control': 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (path === '/api/tts/proxy' && method === 'POST') {
    const body = await readJsonBody(request);
    const provider = String(body?.provider || 'google');
    const apiKey = String(body?.apiKey || '').trim();
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const voice = typeof body?.voice === 'string' ? body.voice.trim() : '';
    const stylePrompt = typeof body?.stylePrompt === 'string' ? body.stylePrompt.trim().slice(0, 300) : '';
    const customEndpoint = String(body?.customEndpoint || '').trim();
    const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
    const rawSpeed = Number(body?.speed);
    const speed = Number.isFinite(rawSpeed) ? Math.max(0.75, Math.min(1.6, rawSpeed)) : 1;

    if (!text || text.length > 3000) {
      return jsonResponse({ error: 'Der Vorlesetext fehlt oder ist zu lang (max. 3.000 Zeichen).' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (!['google', 'openai', 'elevenlabs', 'custom'].includes(provider)) {
      return jsonResponse({ error: 'Unbekannter Vorlese-Anbieter.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (model && (model.length > 120 || !/^[A-Za-z0-9._:/-]+$/.test(model))) {
      return jsonResponse({ error: 'Ungültiges TTS-Modell.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (!apiKey && provider !== 'custom') {
      return jsonResponse({ error: 'Bitte hinterlege einen API-Key für den gewählten Vorlese-Anbieter.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }
    if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
      return jsonResponse({ error: 'Der eigene TTS-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      if (provider === 'google') {
        const targetModel = (model || 'gemini-3.8-flash-lite-tts').replace(/^models\//, '');
        const voiceName = /^[A-Za-z0-9_-]{2,40}$/.test(voice) ? voice : 'Kore';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
        const promptText = stylePrompt ? `${stylePrompt}\n\n${text}` : text;
        const resp = await fetchPublic(
          apiUrl,
          {
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
          },
          fetchImpl,
        );
        if (!resp.ok) {
          await resp.body?.cancel();
          const msg =
            resp.status === 401 || resp.status === 403
              ? 'API-Key ungültig oder ohne Berechtigung.'
              : resp.status === 429
                ? 'Anbieter-Kontingent erreicht (429). Bitte später erneut versuchen.'
                : `Google TTS Fehler (${resp.status})`;
          return jsonResponse({ error: msg }, resp.status, { 'Cache-Control': 'no-store' });
        }
        const raw = await readPublicText(resp);
        const parsed = JSON.parse(raw) as {
          candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
        };
        const base64Audio = parsed.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          return jsonResponse({ error: 'Google AI Studio hat keine Audiodaten zurückgegeben.' }, 502, {
            'Cache-Control': 'no-store',
          });
        }
        const wavBytes = ensureWavBytes(base64ToUint8Array(base64Audio), 24000);
        return new Response(wavBytes.buffer as ArrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      if (provider === 'elevenlabs') {
        const safeVoice = /^[A-Za-z0-9_-]{8,64}$/.test(voice) ? voice : '21m00Tcm4TlvDq8ikWAM';
        const resp = await fetchPublic(
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
          fetchImpl,
        );
        if (!resp.ok) {
          await resp.body?.cancel();
          return jsonResponse({ error: `ElevenLabs Fehler (${resp.status})` }, resp.status, {
            'Cache-Control': 'no-store',
          });
        }
        const audio = await readAudioBytesLimited(resp);
        return new Response(audio.buffer as ArrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      const endpoint =
        provider === 'openai' ? 'https://api.openai.com/v1/audio/speech' : customEndpoint;
      const targetModel = model || (provider === 'openai' ? 'gpt-4o-mini-tts' : 'tts-1');
      const resp = await fetchPublic(
        endpoint,
        {
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
        },
        fetchImpl,
      );
      if (!resp.ok) {
        await resp.body?.cancel();
        const msg =
          resp.status === 401 || resp.status === 403
            ? 'API-Key ungültig oder ohne Berechtigung.'
            : resp.status === 429
              ? 'Anbieter-Kontingent erreicht (429). Bitte später erneut versuchen.'
              : `TTS-Anbieter Fehler (${resp.status})`;
        return jsonResponse({ error: msg }, resp.status, { 'Cache-Control': 'no-store' });
      }
      const contentType = resp.headers.get('content-type') || 'audio/mpeg';
      const audio = await readAudioBytesLimited(resp);
      return new Response(audio.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': /^audio\//i.test(contentType) ? contentType : 'audio/mpeg',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return jsonResponse({ error: 'Sprachausgabe beim Anbieter fehlgeschlagen.' }, 502, {
        'Cache-Control': 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
