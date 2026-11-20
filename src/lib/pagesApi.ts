import { isDiagnostic } from './diagnosticEvents.ts';
import { isSafeHttpUrl } from './publicHttpUrl.ts';
import { parseFeedPayload } from './rssParser.ts';
import type { NewsSource } from '../types/news.ts';

export interface PagesApiEnv {
  OPENNEWS_DIAGNOSTICS?: string;
  OPENNEWS_ORIGIN?: string;
}

export interface ExtractedArticlePayload {
  paragraphs: string[];
  headingIndexes: number[];
  ogImage?: string;
}

export interface PagesApiDeps {
  fetchImpl?: typeof fetch;
  extractArticle?: (response: Response, finalUrl: string) => Promise<ExtractedArticlePayload>;
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 512 * 1024;

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

async function fetchPublic(
  rawUrl: string,
  options: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let url = rawUrl;
  const signal = options.signal ?? AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSafeHttpUrl(url)) throw new Error('Invalid public URL');
    const response = await fetchImpl(url, { ...options, redirect: 'manual', signal });
    const location = response.headers.get('location');
    if (options.method === 'POST' || !location || ![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    await response.body?.cancel();
    url = new URL(location, url).href;
  }
  throw new Error('Too many redirects');
}

async function readPublicText(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Response exceeds size limit');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
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
          const rawText = await readPublicText(response);
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
    return jsonResponse({ articles: allArticles, feedStatuses });
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
          const absUrl = href.startsWith('http') ? href : new URL(href, baseOrigin).toString();
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
    const isPreload = url.searchParams.get('preload') === '1';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const resp = await fetchPublic(
        targetUrl,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OpenNewsReader/1.0)',
            Accept: 'text/html,application/xhtml+xml',
          },
        },
        fetchImpl,
      );
      if (!resp.ok) {
        await resp.body?.cancel();
        if (isPreload) {
          return jsonResponse({ paragraphs: [], headingIndexes: [], unavailable: true }, 200, {
            'Cache-Control': 'no-store',
          });
        }
        return jsonResponse({ error: 'Artikel konnte nicht geladen werden' }, 502);
      }
      const finalUrl = resp.url || targetUrl;
      const extracted = deps.extractArticle
        ? await deps.extractArticle(resp, finalUrl)
        : { paragraphs: [], headingIndexes: [] };
      return jsonResponse(extracted, 200, { 'Cache-Control': 'no-store' });
    } catch {
      if (isPreload) {
        return jsonResponse({ paragraphs: [], headingIndexes: [], unavailable: true }, 200, {
          'Cache-Control': 'no-store',
        });
      }
      return jsonResponse({ error: 'Zeitüberschreitung beim Laden des Artikels' }, 504);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (path === '/api/ai/proxy' && method === 'POST') {
    const body = await readJsonBody(request);
    const provider = String(body?.provider || 'google');
    const apiKey = String(body?.apiKey || '').trim();
    const model = String(body?.model || '').trim();
    const prompt = String(body?.prompt || '').trim();
    const customEndpoint = String(body?.customEndpoint || '').trim();

    if (!prompt || !model) {
      return jsonResponse({ error: 'Modell oder Prompt fehlt.' }, 400);
    }
    if (!apiKey) {
      return jsonResponse({ error: 'Bitte hinterlege deinen API-Key in den Einstellungen.' }, 400);
    }
    if (!['google', 'anthropic', 'openai', 'mistral', 'custom'].includes(provider)) {
      return jsonResponse({ error: 'Unbekannter KI-Anbieter.' }, 400);
    }
    if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
      return jsonResponse({ error: 'Der eigene KI-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' }, 400);
    }

    try {
      if (provider === 'google') {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const resp = await fetchPublic(
          apiUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3 },
            }),
          },
          fetchImpl,
        );
        const json = (JSON.parse(await readPublicText(resp))) as {
          error?: { message?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        if (!resp.ok) {
          return jsonResponse({ error: json.error?.message || 'Google AI Studio Fehler' }, resp.status);
        }
        return jsonResponse({ text: json.candidates?.[0]?.content?.parts?.[0]?.text || '' });
      }

      if (provider === 'anthropic') {
        const resp = await fetchPublic(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
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
        const json = (JSON.parse(await readPublicText(resp))) as {
          error?: { message?: string };
          content?: Array<{ text?: string }>;
        };
        if (!resp.ok) {
          return jsonResponse({ error: json.error?.message || 'Anthropic Fehler' }, resp.status);
        }
        return jsonResponse({ text: json.content?.[0]?.text || '' });
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
      const json = (JSON.parse(await readPublicText(resp))) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (!resp.ok) {
        return jsonResponse({ error: json.error?.message || 'KI-Provider Fehler' }, resp.status);
      }
      return jsonResponse({ text: json.choices?.[0]?.message?.content || '' });
    } catch {
      return jsonResponse({ error: 'Verbindung zum KI-Anbieter fehlgeschlagen' }, 502);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
