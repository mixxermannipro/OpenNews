import express from 'express';
import { JSDOM } from 'jsdom';
import { extractArticle, preStripHtml } from './src/lib/articleExtraction.ts';
import helmet from 'helmet';
import { isDiagnostic } from './src/lib/diagnosticEvents.ts';
import { rateLimit } from 'express-rate-limit';
import { fetchPublic, isSafeHttpUrl, readPublicText } from './src/lib/publicHttp.ts';
import http from 'node:http';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { createServer as createViteServer } from 'vite';
import { slimFeedArticle } from './src/lib/feedRefresh.ts';
import { parseFeedPayload, repairTruncatedFeedXml } from './src/lib/rssParser.ts';
import { GoogleGenAI } from '@google/genai';
import { ensureWavBytes } from './src/lib/ttsClient.ts';
import type { NewsSource } from './src/types/news.ts';

const gzipAsync = promisify(gzip);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
const trustedProxies = process.env.OPENNEWS_TRUST_PROXY?.split(',').map(proxy => proxy.trim()).filter(Boolean);
if (trustedProxies?.length) {
  for (const proxy of trustedProxies) {
    const [address, prefix, extra] = proxy.split('/');
    const version = isIP(address);
    if (!version || extra !== undefined || (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128) || Number(prefix) === 0))) {
      throw new Error('OPENNEWS_TRUST_PROXY erwartet einzelne IP-Adressen oder begrenzte CIDR-Netze.');
    }
  }
  app.set('trust proxy', trustedProxies);
}
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: process.env.NODE_ENV === 'production',
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  next();
});
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  const site = req.get('sec-fetch-site');
  const expected = process.env.OPENNEWS_ORIGIN || `${req.protocol}://${req.get('host')}`;
  if (origin && origin !== expected && (process.env.OPENNEWS_ORIGIN || site !== 'same-origin')) {
    res.status(403).json({ error: 'Diese Herkunft ist nicht erlaubt.' });
    return;
  }
  next();
});
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 65,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es gleich erneut.' },
}));
app.use('/api/ai/proxy', rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele KI-Anfragen. Bitte versuche es gleich erneut.' },
}));
app.use('/api/tts/proxy', rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele Vorlese-Anfragen. Bitte versuche es gleich erneut.' },
}));
app.use(express.json({ limit: '128kb' }));
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(400).json({ error: 'Ungültige JSON-Anfrage.' });
    return;
  }
  next(err);
});

async function sendJson(req: express.Request, res: express.Response, payload: unknown, cacheControl?: string) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  const body = JSON.stringify(payload);
  const acceptEncoding = req.get('accept-encoding') || '';
  if (body.length >= 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    const compressed = await gzipAsync(Buffer.from(body, 'utf8'), { level: 5 });
    res
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Encoding', 'gzip')
      .setHeader('Vary', 'Accept-Encoding')
      .send(compressed);
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8').send(body);
}

app.get('/api/diagnostics', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ enabled: process.env.OPENNEWS_DIAGNOSTICS === '1' });
});

app.post('/api/diagnostics', (req, res) => {
  if (process.env.OPENNEWS_DIAGNOSTICS !== '1') {
    res.sendStatus(404);
    return;
  }
  if (!isDiagnostic(req.body?.event) || Object.keys(req.body).length !== 1) {
    res.sendStatus(400);
    return;
  }
  console.info(JSON.stringify({ event: req.body.event, hour: Math.floor(Date.now() / 3_600_000) }));
  res.status(204).end();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'OpenNews' });
});

interface CachedFeedEntry {
  articles: ReturnType<typeof parseFeedPayload>;
  fetchedAt: number;
  etag?: string;
  lastModified?: string;
}

const FEED_CACHE_TTL_MS = 90_000;
const FEED_CACHE_MAX_ENTRIES = 140;
const feedCache = new Map<string, CachedFeedEntry>();
const inFlightFeeds = new Map<string, Promise<{ sourceId: string; ok: boolean; count: number; articles: ReturnType<typeof parseFeedPayload> }>>();

function touchFeedCache(key: string, entry: CachedFeedEntry) {
  if (feedCache.has(key)) feedCache.delete(key);
  feedCache.set(key, entry);
  while (feedCache.size > FEED_CACHE_MAX_ENTRIES) {
    const oldest = feedCache.keys().next().value;
    if (oldest === undefined) break;
    feedCache.delete(oldest);
  }
}

app.post('/api/feeds/fetch', async (req, res) => {
  const feeds = Array.isArray(req.body?.feeds) ? (req.body.feeds as NewsSource[]) : [];
  if (feeds.length === 0) {
    res.json({ articles: [], feedStatuses: [] });
    return;
  }

  const forceRefresh = req.body?.force === true;
  const now = Date.now();
  const limitedFeeds = feeds.slice(0, 20);
  const results = await Promise.all(
    limitedFeeds.map(async (rawSource) => {
      if (
        !rawSource
        || typeof rawSource !== 'object'
        || typeof rawSource.id !== 'string'
        || typeof rawSource.url !== 'string'
        || !isSafeHttpUrl(rawSource.url)
      ) {
        return { sourceId: typeof rawSource?.id === 'string' ? rawSource.id : 'unknown', ok: false, count: 0, articles: [] };
      }
      const source = rawSource;
      const cacheKey = `${source.id}|${source.url}`;
      const cached = feedCache.get(cacheKey);
      if (!forceRefresh && cached && now - cached.fetchedAt < FEED_CACHE_TTL_MS) {
        return { sourceId: source.id, ok: true, count: cached.articles.length, articles: cached.articles };
      }

      const existingFlight = inFlightFeeds.get(cacheKey);
      if (existingFlight) {
        return existingFlight;
      }

      const fetchTask = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5500);
        try {
          const headers: Record<string, string> = {
            'User-Agent': 'OpenNews/1.0 (+https://opennews.local; RSS Reader)',
            Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          };
          if (cached?.etag) headers['If-None-Match'] = cached.etag;
          if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

          const response = await fetchPublic(source.url, {
            signal: controller.signal,
            headers,
          });
          if (response.status === 304 && cached) {
            await response.body?.cancel();
            const refreshed: CachedFeedEntry = {
              ...cached,
              fetchedAt: Date.now(),
              etag: response.headers.get('etag') || cached.etag,
              lastModified: response.headers.get('last-modified') || cached.lastModified,
            };
            touchFeedCache(cacheKey, refreshed);
            return { sourceId: source.id, ok: true, count: refreshed.articles.length, articles: refreshed.articles };
          }
          if (!response.ok) {
            await response.body?.cancel();
            if (cached && Date.now() - cached.fetchedAt < 10 * 60_000) {
              return { sourceId: source.id, ok: true, count: cached.articles.length, articles: cached.articles };
            }
            return { sourceId: source.id, ok: false, count: 0, articles: [] };
          }
          const rawText = repairTruncatedFeedXml(
            await readPublicText(response, 1_800_000, { truncateOnLimit: true }),
          );
          const articles = parseFeedPayload(rawText, source).map(slimFeedArticle);
          touchFeedCache(cacheKey, {
            articles,
            fetchedAt: Date.now(),
            etag: response.headers.get('etag') || undefined,
            lastModified: response.headers.get('last-modified') || undefined,
          });
          return { sourceId: source.id, ok: true, count: articles.length, articles };
        } catch {
          if (cached && Date.now() - cached.fetchedAt < 10 * 60_000) {
            return { sourceId: source.id, ok: true, count: cached.articles.length, articles: cached.articles };
          }
          return { sourceId: source.id, ok: false, count: 0, articles: [] };
        } finally {
          clearTimeout(timeout);
          inFlightFeeds.delete(cacheKey);
        }
      })();

      inFlightFeeds.set(cacheKey, fetchTask);
      return fetchTask;
    })
  );

  const allArticles = results.flatMap((r) => r.articles);
  const feedStatuses = results.map(({ sourceId, ok, count }) => ({ sourceId, ok, count }));
  await sendJson(req, res, { articles: allArticles, feedStatuses }, 'no-store');
});

app.get('/api/feeds/discover', async (req, res) => {
  const rawQuery = String(req.query.q || '').trim();
  if (!rawQuery) {
    res.json({ discovered: [] });
    return;
  }

  // Only attempt live website discovery if query looks like a domain or URL
  const looksLikeUrlOrDomain = /^https?:\/\//i.test(rawQuery) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(rawQuery);
  if (!looksLikeUrlOrDomain) {
    res.json({ discovered: [] });
    return;
  }

  const normalizedUrl = /^https?:\/\//i.test(rawQuery) ? rawQuery : `https://${rawQuery}`;
  if (!isSafeHttpUrl(normalizedUrl)) {
    res.json({ discovered: [] });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetchPublic(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenNews/1.0 (+https://opennews.local)',
        Accept: 'text/html,application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml',
      },
    });
    if (!resp.ok) {
      await resp.body?.cancel();
      res.json({ discovered: [] });
      return;
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
      (item, idx, arr) => arr.findIndex((x) => x.url === item.url) === idx
    );
    res.json({ discovered: unique.slice(0, 6) });
  } catch {
    res.json({ discovered: [] });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/media/transcript', async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url.startsWith('https://') || !isSafeHttpUrl(url)) {
    res.sendStatus(400);
    return;
  }
  try {
    const response = await fetchPublic(url, { signal: AbortSignal.timeout(6000) });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !response.url.startsWith('https://') ||
      !/^(text\/(vtt|plain)|application\/(x-subrip|octet-stream))(;|$)/i.test(type)) {
      await response.body?.cancel();
      res.sendStatus(502);
      return;
    }
    const text = await readPublicText(response, 512 * 1024);
    res.set('Cache-Control', 'no-store').type('text/plain').send(text);
  } catch {
    res.sendStatus(502);
  }
});

interface CachedArticleEntry {
  data: ReturnType<typeof extractArticle> & { unavailable?: boolean };
  fetchedAt: number;
  ttlMs: number;
}

const ARTICLE_CACHE_TTL_MS = 10 * 60_000;
const ARTICLE_NEGATIVE_TTL_MS = 2 * 60_000;
const ARTICLE_CACHE_MAX_ENTRIES = 120;
const MAX_ARTICLE_HTML_BYTES = 2 * 1024 * 1024;
const articleCache = new Map<string, CachedArticleEntry>();
const inFlightArticles = new Map<string, Promise<CachedArticleEntry['data']>>();

function touchArticleCache(key: string, data: CachedArticleEntry['data'], ttlMs: number) {
  if (articleCache.has(key)) articleCache.delete(key);
  articleCache.set(key, { data, fetchedAt: Date.now(), ttlMs });
  while (articleCache.size > ARTICLE_CACHE_MAX_ENTRIES) {
    const oldest = articleCache.keys().next().value;
    if (oldest === undefined) break;
    articleCache.delete(oldest);
  }
}

app.get('/api/article/extract', async (req, res) => {
  const url = String(req.query.url || '');
  if (!isSafeHttpUrl(url)) {
    res.status(400).json({ error: 'Ungültige Artikel-URL' });
    return;
  }
  const articleTitle = typeof req.query.title === 'string' ? req.query.title.trim().slice(0, 300) : undefined;
  const cacheKey = url;

  const cached = articleCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    await sendJson(req, res, cached.data, 'no-store');
    return;
  }

  let task = inFlightArticles.get(cacheKey);
  if (!task) {
    task = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const unavailablePayload: CachedArticleEntry['data'] = {
        paragraphs: [],
        headingIndexes: [],
        unavailable: true,
      };
      try {
        const resp = await fetchPublic(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        const contentType = resp.headers.get('content-type') || '';
        if (!resp.ok || (contentType && !/^(?:text\/(?:html|plain)|application\/xhtml\+xml)\b/i.test(contentType))) {
          await resp.body?.cancel();
          if ([401, 403, 404, 410, 451].includes(resp.status) || contentType) {
            touchArticleCache(cacheKey, unavailablePayload, ARTICLE_NEGATIVE_TTL_MS);
          }
          return unavailablePayload;
        }
        const rawHtml = await readPublicText(resp, MAX_ARTICLE_HTML_BYTES);
        const cleanHtml = preStripHtml(rawHtml);
        const dom = new JSDOM(cleanHtml, { url: resp.url });
        try {
          const extracted = extractArticle(dom.window.document, resp.url, articleTitle);
          if (extracted.paragraphs.length > 0) {
            touchArticleCache(cacheKey, extracted, ARTICLE_CACHE_TTL_MS);
            return extracted;
          }
          const emptyResult = { ...extracted, unavailable: true };
          touchArticleCache(cacheKey, emptyResult, ARTICLE_NEGATIVE_TTL_MS);
          return emptyResult;
        } finally {
          dom.window.close();
        }
      } catch {
        return unavailablePayload;
      } finally {
        clearTimeout(timeout);
        inFlightArticles.delete(cacheKey);
      }
    })();
    inFlightArticles.set(cacheKey, task);
  }

  const extracted = await task;
  await sendJson(req, res, extracted, 'no-store');
});

const MAX_AI_PROMPT_CHARS = 60_000;
const MAX_AI_MODEL_CHARS = 120;
const SAFE_MODEL_RE = /^[A-Za-z0-9._:/-]+$/;

async function safeParseJson<T extends Record<string, unknown>>(response: Awaited<ReturnType<typeof fetchPublic>>): Promise<T> {
  const raw = await readPublicText(response);
  if (!raw.trim()) return {} as T;
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
  } catch {
    return { error: { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) } } as unknown as T;
  }
}

app.post('/api/ai/proxy', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const provider = String(req.body?.provider || 'google');
  const apiKey = String(req.body?.apiKey || '').trim();
  const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const customEndpoint = String(req.body?.customEndpoint || '').trim();

  if (!prompt || !model) {
    res.status(400).json({ error: 'Modell oder Prompt fehlt.' });
    return;
  }
  if (prompt.length > MAX_AI_PROMPT_CHARS) {
    res.status(400).json({ error: 'Der Prompt überschreitet die maximal erlaubte Länge.' });
    return;
  }
  if (model.length > MAX_AI_MODEL_CHARS || !SAFE_MODEL_RE.test(model)) {
    res.status(400).json({ error: 'Ungültiger Modellname.' });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: 'Bitte hinterlege deinen API-Key in den Einstellungen.' });
    return;
  }

  if (!['google', 'anthropic', 'openai', 'mistral', 'custom'].includes(provider)) {
    res.status(400).json({ error: 'Unbekannter KI-Anbieter.' });
    return;
  }
  if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
    res.status(400).json({ error: 'Der eigene KI-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await fetchPublic(url, {
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
      }>(resp);
      if (!resp.ok) {
        res.status(resp.status).json({ error: json.error?.message || 'Google AI Studio Fehler' });
        return;
      }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      res.json({ text });
      return;
    }

    if (provider === 'anthropic') {
      const resp = await fetchPublic('https://api.anthropic.com/v1/messages', {
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
      }>(resp);
      if (!resp.ok) {
        res.status(resp.status).json({ error: json.error?.message || 'Anthropic Fehler' });
        return;
      }
      const text = json.content?.[0]?.text || '';
      res.json({ text });
      return;
    }

    const endpoint =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : provider === 'mistral'
          ? 'https://api.mistral.ai/v1/chat/completions'
          : customEndpoint;

    const resp = await fetchPublic(endpoint, {
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
    }>(resp);
    if (!resp.ok) {
      res.status(resp.status).json({ error: json.error?.message || 'KI-Provider Fehler' });
      return;
    }
    const text = json.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch {
    res.status(502).json({
      error: 'Verbindung zum KI-Anbieter fehlgeschlagen',
    });
  } finally {
    clearTimeout(timeout);
  }
});

const MAX_TTS_BYTES = 10 * 1024 * 1024;

async function readAudioBufferLimited(resp: Awaited<ReturnType<typeof fetchPublic>>): Promise<Buffer> {
  const reader = resp.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_TTS_BYTES) {
      await reader.cancel();
      throw new Error('Audio-Antwort überschreitet das Größenlimit.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

app.post('/api/tts/proxy', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const provider = String(req.body?.provider || 'google');
  const apiKey = String(req.body?.apiKey || '').trim();
  const model = String(req.body?.model || '').trim();
  const voice = String(req.body?.voice || '').trim();
  const stylePrompt = String(req.body?.stylePrompt || '').trim().slice(0, 300);
  const customEndpoint = String(req.body?.customEndpoint || '').trim();
  const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim();
  const rawSpeed = Number(req.body?.speed);
  const speed = Number.isFinite(rawSpeed) ? Math.max(0.75, Math.min(1.6, rawSpeed)) : 1;

  if (!text || text.length > 3000) {
    res.status(400).json({ error: 'Der Vorlesetext fehlt oder ist zu lang (max. 3.000 Zeichen).' });
    return;
  }
  if (!['google', 'openai', 'elevenlabs', 'custom'].includes(provider)) {
    res.status(400).json({ error: 'Unbekannter Vorlese-Anbieter.' });
    return;
  }
  if (!apiKey && provider !== 'custom') {
    res.status(400).json({ error: 'Bitte hinterlege einen API-Key für den gewählten Vorlese-Anbieter.' });
    return;
  }
  if (provider === 'custom' && (!isSafeHttpUrl(customEndpoint) || new URL(customEndpoint).protocol !== 'https:')) {
    res.status(400).json({ error: 'Der eigene TTS-Endpunkt benötigt eine öffentliche HTTPS-Adresse.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    if (provider === 'google') {
      const targetModel = (model || 'gemini-3.8-flash-lite-tts').replace(/^models\//, '');
      const voiceName = /^[A-Za-z0-9_-]{2,40}$/.test(voice) ? voice : 'Kore';
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 20_000,
        },
      });
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                ...(stylePrompt ? { speechMetadata: { style: stylePrompt } } : {}),
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Google AI Studio hat keine Audiodaten zurückgegeben.' });
        return;
      }
      const wavBytes = ensureWavBytes(new Uint8Array(Buffer.from(base64Audio, 'base64')), 24000);
      res.set({
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      }).send(Buffer.from(wavBytes));
      return;
    }

    if (provider === 'elevenlabs') {
      const safeVoice = /^[A-Za-z0-9_-]{8,64}$/.test(voice) ? voice : '21m00Tcm4TlvDq8ikWAM';
      const resp = await fetchPublic(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoice)}`, {
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
      });
      if (!resp.ok) {
        const msg = await readPublicText(resp).catch(() => '');
        res.status(resp.status).json({ error: msg ? `ElevenLabs Fehler (${resp.status})` : 'ElevenLabs Anfrage fehlgeschlagen.' });
        return;
      }
      const audio = await readAudioBufferLimited(resp);
      res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }).send(audio);
      return;
    }

    const endpoint = provider === 'openai'
      ? 'https://api.openai.com/v1/audio/speech'
      : customEndpoint;
    const targetModel = model || (provider === 'openai' ? 'gpt-4o-mini-tts' : 'tts-1');
    const resp = await fetchPublic(endpoint, {
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
      res.status(resp.status).json({ error: `TTS-Anbieter Fehler (${resp.status})` });
      return;
    }
    const contentType = resp.headers.get('content-type') || 'audio/mpeg';
    const audio = await readAudioBufferLimited(resp);
    res.set({
      'Content-Type': /^audio\//i.test(contentType) ? contentType : 'audio/mpeg',
      'Cache-Control': 'no-store',
    }).send(audio);
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 502;
    const safeStatus = status >= 400 && status < 600 ? status : 502;
    const message =
      safeStatus === 401 || safeStatus === 403
        ? 'API-Key ungültig oder ohne Berechtigung.'
        : safeStatus === 429
          ? 'Anbieter-Kontingent erreicht (429). Bitte später erneut versuchen.'
          : 'Sprachausgabe beim Anbieter fehlgeschlagen.';
    res.status(safeStatus).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
});

async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (isProd) {
    app.use(helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        frameAncestors: ["'self'"],
        connectSrc: ["'self'", 'https:'],
        workerSrc: ["'self'", 'blob:'],
      },
    }));
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenNews server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start();
