import express from 'express';
import { JSDOM } from 'jsdom';
import { extractArticle, preStripHtml } from './src/lib/articleExtraction.ts';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fetchPublic, readPublicText } from './src/lib/publicHttp.ts';
import {
  checkApiOrigin,
  handleAiProxy,
  handleArticleExtract,
  handleDiagnosticsPost,
  handleFeedsDiscover,
  handleFeedsFetch,
  handleMediaTranscript,
  handleTtsProxy,
  RATE_LIMIT_AI,
  RATE_LIMIT_GENERAL,
  RATE_LIMIT_TTS,
  type ApiResult,
  type ApiRuntimeDeps,
} from './src/lib/apiCore.ts';
import { hasPaywallMarkup, hasRobotsNoArchiveOrNoAi } from './src/lib/publisherPolicy.ts';
import http from 'node:http';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { createServer as createViteServer } from 'vite';
import type { NewsArticle, NewsSource } from './src/types/news.ts';

const gzipAsync = promisify(gzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

interface CachedFeedEntry {
  articles: NewsArticle[];
  fetchedAt: number;
}

const FEED_CACHE_TTL_MS = 90_000;
const FEED_CACHE_MAX_ENTRIES = 140;

export interface ServerAppOptions {
  runtimeDeps?: Partial<ApiRuntimeDeps>;
  disableRateLimit?: boolean;
  configuredOrigin?: string;
}

async function sendJson(
  req: express.Request,
  res: express.Response,
  payload: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  const body = JSON.stringify(payload);
  const acceptEncoding = req.get('accept-encoding') || '';
  if (status === 200 && body.length >= 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    const compressed = await gzipAsync(Buffer.from(body, 'utf8'), { level: 5 });
    res
      .status(status)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Encoding', 'gzip')
      .setHeader('Vary', 'Accept-Encoding')
      .send(compressed);
    return;
  }
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(body);
}

async function sendApiResult(req: express.Request, res: express.Response, result: ApiResult) {
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v);
    }
  }
  if (result.kind === 'empty') {
    res.sendStatus(result.status);
    return;
  }
  if (result.kind === 'text') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(result.status).type('text/plain').send(String(result.body ?? ''));
    return;
  }
  if (result.kind === 'bytes') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const bytes = result.body instanceof Uint8Array ? result.body : new Uint8Array(0);
    res.status(result.status).send(Buffer.from(bytes));
    return;
  }
  await sendJson(req, res, result.body, result.status, result.headers);
}

export function createApp(options: ServerAppOptions = {}) {
  const app = express();
  const feedCache = new Map<string, CachedFeedEntry>();

  function touchFeedCache(key: string, entry: CachedFeedEntry) {
    if (feedCache.has(key)) feedCache.delete(key);
    feedCache.set(key, entry);
    while (feedCache.size > FEED_CACHE_MAX_ENTRIES) {
      const oldest = feedCache.keys().next().value;
      if (oldest === undefined) break;
      feedCache.delete(oldest);
    }
  }

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

  // CSP stays disabled in dev so Vite's inline preamble/module scripts can run;
  // in production (`start()` when NODE_ENV=production) strict Helmet CSP is attached before static serving.
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
    const fullUrl = `${req.protocol}://${req.get('host') || 'localhost'}${req.originalUrl}`;
    const originError = checkApiOrigin(
      req.headers,
      fullUrl,
      options.configuredOrigin ?? process.env.OPENNEWS_ORIGIN,
      req.originalUrl.split('?')[0],
    );
    if (originError) {
      res.status(403).json({ error: originError.error });
      return;
    }
    next();
  });

  if (!options.disableRateLimit) {
    app.use('/api', rateLimit({
      windowMs: RATE_LIMIT_GENERAL.windowMs,
      limit: RATE_LIMIT_GENERAL.limit,
      skip: (req) => req.path === '/health',
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Zu viele Anfragen. Bitte versuche es gleich erneut.' },
    }));
    app.use('/api/ai/proxy', rateLimit({
      windowMs: RATE_LIMIT_AI.windowMs,
      limit: RATE_LIMIT_AI.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Zu viele KI-Anfragen. Bitte versuche es gleich erneut.' },
    }));
    app.use('/api/tts/proxy', rateLimit({
      windowMs: RATE_LIMIT_TTS.windowMs,
      limit: RATE_LIMIT_TTS.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Zu viele Vorlese-Anfragen. Bitte versuche es gleich erneut.' },
    }));
  }

  app.use(express.json({ limit: '128kb' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(400).json({ error: 'Ungültige JSON-Anfrage.' });
      return;
    }
    next(err);
  });

  const defaultReadText: ApiRuntimeDeps['readPublicText'] = async (resp, maxBytes, opts) =>
    readPublicText(resp as unknown as Awaited<ReturnType<typeof fetchPublic>>, maxBytes, opts);

  const defaultFetchPublic: ApiRuntimeDeps['fetchPublic'] = async (url, init) =>
    fetchPublic(url, init as NonNullable<Parameters<typeof fetchPublic>[1]>) as unknown as Response;

  const runtimeDeps: ApiRuntimeDeps = {
    fetchPublic: options.runtimeDeps?.fetchPublic ?? defaultFetchPublic,
    readPublicText: options.runtimeDeps?.readPublicText ?? defaultReadText,
    extractArticle: options.runtimeDeps?.extractArticle ?? (async (resp, finalUrl, articleTitle) => {
      const rawHtml = await (options.runtimeDeps?.readPublicText ?? defaultReadText)(resp, 2 * 1024 * 1024);
      if (hasRobotsNoArchiveOrNoAi(resp.headers, rawHtml)) {
        return { paragraphs: [], headingIndexes: [], unavailable: true };
      }
      if (hasPaywallMarkup(rawHtml)) {
        return { paragraphs: [], headingIndexes: [], unavailable: true, blockedWall: true };
      }
      const cleanHtml = preStripHtml(rawHtml);
      const dom = new JSDOM(cleanHtml, { url: finalUrl });
      try {
        const extracted = extractArticle(dom.window.document, finalUrl, articleTitle);
        if (extracted.paragraphs.length > 0) return extracted;
        return { ...extracted, unavailable: true };
      } finally {
        dom.window.close();
      }
    }),
    diagnosticsEnabled: options.runtimeDeps?.diagnosticsEnabled ?? process.env.OPENNEWS_DIAGNOSTICS === '1',
    optOutDomainsCsv: options.runtimeDeps?.optOutDomainsCsv ?? process.env.OPENNEWS_OPTOUT_DOMAINS,
  };

  app.get('/api/diagnostics', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ enabled: Boolean(runtimeDeps.diagnosticsEnabled) });
  });

  app.post('/api/diagnostics', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
    await sendApiResult(req, res, handleDiagnosticsPost(body, Boolean(runtimeDeps.diagnosticsEnabled)));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'OpenNews' });
  });

  app.post('/api/feeds/fetch', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
    const forceRefresh = body?.force === true;
    const now = Date.now();
    const result = await handleFeedsFetch(body, runtimeDeps, {
      getCached: (source: NewsSource) => {
        if (forceRefresh) return undefined;
        const cached = feedCache.get(`${source.id}|${source.url}`);
        return cached && now - cached.fetchedAt < FEED_CACHE_TTL_MS ? cached.articles : undefined;
      },
      onSourceResult: (source, _resp, articles) => {
        touchFeedCache(`${source.id}|${source.url}`, { articles, fetchedAt: Date.now() });
      },
    });
    await sendApiResult(req, res, result);
  });

  app.get('/api/feeds/discover', async (req, res) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
    await sendApiResult(req, res, await handleFeedsDiscover(rawQuery, runtimeDeps));
  });

  app.get('/api/media/transcript', async (req, res) => {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url : '';
    await sendApiResult(req, res, await handleMediaTranscript(targetUrl, runtimeDeps));
  });

  app.get('/api/article/extract', async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    const articleTitle = typeof req.query.title === 'string' ? req.query.title.trim().slice(0, 300) : undefined;
    await sendApiResult(req, res, await handleArticleExtract(url, articleTitle, runtimeDeps));
  });

  app.post('/api/ai/proxy', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
    await sendApiResult(req, res, await handleAiProxy(body, runtimeDeps));
  });

  app.post('/api/tts/proxy', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
    await sendApiResult(req, res, await handleTtsProxy(body, runtimeDeps));
  });

  return app;
}

export async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = createApp();
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

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  void start();
}
