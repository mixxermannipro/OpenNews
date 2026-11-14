import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fetchPublic, isSafeHttpUrl, readPublicText } from './src/lib/publicHttp.ts';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { parseFeedPayload, stripHtml } from './src/lib/rssParser.ts';
import type { NewsSource } from './src/types/news.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: process.env.NODE_ENV === 'production',
  referrerPolicy: { policy: 'no-referrer' },
}));
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
  limit: 45,
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
app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'OpenNews' });
});

app.post('/api/feeds/fetch', async (req, res) => {
  const feeds = Array.isArray(req.body?.feeds) ? (req.body.feeds as NewsSource[]) : [];
  if (feeds.length === 0) {
    res.json({ articles: [], feedStatuses: [] });
    return;
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
        const response = await fetchPublic(source.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'OpenNews/1.0 (+https://opennews.local; RSS Reader)',
            Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*',
          },
        });
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
    })
  );

  const allArticles = results.flatMap((r) => r.articles);
  const feedStatuses = results.map(({ sourceId, ok, count }) => ({ sourceId, ok, count }));
  res.json({ articles: allArticles, feedStatuses });
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
      (item, idx, arr) => arr.findIndex((x) => x.url === item.url) === idx
    );
    res.json({ discovered: unique.slice(0, 6) });
  } catch {
    res.json({ discovered: [] });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/article/extract', async (req, res) => {
  const url = String(req.query.url || '');
  if (!isSafeHttpUrl(url)) {
    res.status(400).json({ error: 'Ungültige Artikel-URL' });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetchPublic(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenNewsReader/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!resp.ok) {
      await resp.body?.cancel();
      res.status(502).json({ error: 'Artikel konnte nicht geladen werden' });
      return;
    }
    const html = await readPublicText(resp);
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogImageMatch?.[1];

    // A whole-page fallback can mistake navigation and promotions for article text.
    const articleScope = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? '';
    const pMatches = [...articleScope.matchAll(/<(p|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
    const blocks = pMatches.map(match => ({ text: stripHtml(match[2]), heading: /^h[23]$/i.test(match[1]) })).filter(block => block.text);
    const paragraphs = blocks.map(block => block.text);
    const headingIndexes = blocks.flatMap((block, index) => block.heading ? [index] : []);
    res.json({ paragraphs, headingIndexes, ogImage });
  } catch {
    res.status(504).json({ error: 'Zeitüberschreitung beim Laden des Artikels' });
  } finally {
    clearTimeout(timeout);
  }
});

app.post('/api/ai/proxy', async (req, res) => {
  const provider = String(req.body?.provider || 'google');
  const apiKey = String(req.body?.apiKey || '').trim();
  const model = String(req.body?.model || '').trim();
  const prompt = String(req.body?.prompt || '').trim();
  const customEndpoint = String(req.body?.customEndpoint || '').trim();

  if (!prompt || !model) {
    res.status(400).json({ error: 'Modell oder Prompt fehlt.' });
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

  try {
    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await fetchPublic(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });
      const json = (JSON.parse(await readPublicText(resp))) as {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
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
      const json = (JSON.parse(await readPublicText(resp))) as {
        error?: { message?: string };
        content?: Array<{ text?: string }>;
      };
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
    const json = (JSON.parse(await readPublicText(resp))) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
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
        imgSrc: ["'self'", 'https:', 'http:', 'data:', 'blob:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        mediaSrc: ["'self'", 'https:', 'http:', 'blob:'],
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
}

start();
