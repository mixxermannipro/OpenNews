import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSlidingWindowLimiter } from './apiCore.ts';
import { handlePagesApiRequest } from './pagesApi.ts';

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' };
const TEST_DEPS = { disableRateLimit: true } as const;

describe('handlePagesApiRequest', () => {
  it('returns health status without origin headers', async () => {
    const res = await handlePagesApiRequest(new Request('https://opennews-app.pages.dev/api/health'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      ok: true,
      service: 'OpenNews',
      runtime: 'cloudflare-pages',
    });
  });

  it('rejects requests without Origin and Sec-Fetch-Site: same-origin (e.g. curl)', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/article/extract?url=https%3A%2F%2Fexample.org%2Fa'),
      {},
      TEST_DEPS,
    );
    assert.equal(res.status, 403);
  });

  it('rejects cross-origin requests when origin mismatches', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/health', {
        headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(res.status, 403);
  });

  it('enforces general, AI, and TTS rate limits with 429 responses', async () => {
    const general = createSlidingWindowLimiter({ windowMs: 60_000, limit: 2 });
    const ai = createSlidingWindowLimiter({ windowMs: 60_000, limit: 1 });
    const tts = createSlidingWindowLimiter({ windowMs: 60_000, limit: 1 });
    const limiters = { general, ai, tts };

    const req1 = new Request('https://opennews-app.pages.dev/api/diagnostics', { headers: SAME_ORIGIN });
    const req2 = new Request('https://opennews-app.pages.dev/api/diagnostics', { headers: SAME_ORIGIN });
    const req3 = new Request('https://opennews-app.pages.dev/api/diagnostics', { headers: SAME_ORIGIN });

    assert.equal((await handlePagesApiRequest(req1, {}, { rateLimiters: limiters })).status, 200);
    assert.equal((await handlePagesApiRequest(req2, {}, { rateLimiters: limiters })).status, 200);
    const limited = await handlePagesApiRequest(req3, {}, { rateLimiters: limiters });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));

    const aiReq1 = new Request('https://opennews-app.pages.dev/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
      body: JSON.stringify({ provider: 'google', model: 'gemini-flash-latest', prompt: '' }),
    });
    const aiReq2 = new Request('https://opennews-app.pages.dev/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
      body: JSON.stringify({ provider: 'google', model: 'gemini-flash-latest', prompt: '' }),
    });
    const aiLimiters = {
      general: createSlidingWindowLimiter({ windowMs: 60_000, limit: 65 }),
      ai: createSlidingWindowLimiter({ windowMs: 60_000, limit: 1 }),
      tts,
    };
    assert.equal((await handlePagesApiRequest(aiReq1, {}, { rateLimiters: aiLimiters })).status, 400);
    assert.equal((await handlePagesApiRequest(aiReq2, {}, { rateLimiters: aiLimiters })).status, 429);
  });

  it('fetches, slims, and parses RSS feeds', async () => {
    const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Test</title>
        <item>
          <title>Hallo Welt</title>
          <link>https://example.org/news/1</link>
          <description>Kurzer Testbericht</description>
          <pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;

    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/feeds/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          feeds: [{ id: 'test-src', name: 'Test', url: 'https://example.org/rss.xml', format: 'rss', category: 'Welt' }],
        }),
      }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () =>
          new Response(sampleRss, {
            status: 200,
            headers: { 'Content-Type': 'application/rss+xml' },
          }),
      },
    );

    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      articles: Array<{ title: string; link: string }>;
      feedStatuses: Array<{ sourceId: string; ok: boolean; count: number }>;
    };
    assert.equal(data.feedStatuses[0].ok, true);
    assert.equal(data.feedStatuses[0].count, 1);
    assert.equal(data.articles[0].title, 'Hallo Welt');
  });

  it('blocks private/non-public feed URLs', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/feeds/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          feeds: [{ id: 'local', name: 'Local', url: 'http://127.0.0.1/feed.xml', format: 'rss', category: 'Welt' }],
        }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { feedStatuses: Array<{ ok: boolean }> };
    assert.equal(data.feedStatuses[0].ok, false);
  });

  it('discovers alternate RSS links from HTML', async () => {
    const html = `<html><head><link rel="alternate" type="application/rss+xml" title="Mein Feed" href="/feed.xml"></head></html>`;
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/feeds/discover?q=example.org', { headers: SAME_ORIGIN }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () =>
          new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      },
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { discovered: Array<{ name: string; url: string; format: string }> };
    assert.deepEqual(data.discovered, [
      { name: 'Mein Feed', url: 'https://example.org/feed.xml', format: 'rss' },
    ]);
  });

  it('returns extracted article payload via extractor', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/article/extract?url=https%3A%2F%2Fexample.org%2Fa', {
        headers: SAME_ORIGIN,
      }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () => new Response('<html></html>', { status: 200 }),
        extractArticle: async () => ({
          paragraphs: ['Erster Absatz'],
          headingIndexes: [],
          ogImage: 'https://example.org/img.jpg',
        }),
      },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      paragraphs: ['Erster Absatz'],
      headingIndexes: [],
      ogImage: 'https://example.org/img.jpg',
    });
  });

  it('validates AI proxy requests', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({ provider: 'google', model: 'gemini-2.5-flash', prompt: 'Hi' }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(res.status, 400);
  });

  it('rejects oversized prompts and invalid AI model identifiers', async () => {
    const longPromptRes = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          provider: 'google',
          model: 'gemini-2.5-flash',
          apiKey: 'secret',
          prompt: 'a'.repeat(60_001),
        }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(longPromptRes.status, 400);

    const badModelRes = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          provider: 'google',
          model: '../bad model?',
          apiKey: 'secret',
          prompt: 'Hi',
        }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(badModelRes.status, 400);
  });

  it('handles non-JSON upstream error bodies cleanly in AI proxy', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          provider: 'google',
          model: 'gemini-2.5-flash',
          apiKey: 'secret',
          prompt: 'Fasse zusammen',
        }),
      }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () =>
          new Response('<html><body>502 Bad Gateway</body></html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          }),
      },
    );
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = (await res.json()) as { error?: string };
    assert.match(data.error ?? '', /502 Bad Gateway/);
  });

  it('strips sensitive auth headers across cross-origin redirects', async () => {
    const seenHeaders: Array<Record<string, string>> = [];
    let call = 0;
    await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/feeds/discover?q=example.org', { headers: SAME_ORIGIN }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async (_url, init) => {
          const hdrs = new Headers(init?.headers);
          seenHeaders.push(Object.fromEntries(hdrs.entries()));
          call += 1;
          if (call === 1) {
            return new Response(null, {
              status: 302,
              headers: { Location: 'https://other.example/feed.xml' },
            });
          }
          return new Response('<rss><channel></channel></rss>', {
            status: 200,
            headers: { 'Content-Type': 'application/rss+xml' },
          });
        },
      },
    );
    assert.equal(seenHeaders.length, 2);
  });

  it('validates TTS proxy requests and rejects empty text or unknown providers', async () => {
    const emptyRes = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({ provider: 'google', apiKey: 'secret', text: '   ' }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(emptyRes.status, 400);
    assert.equal(emptyRes.headers.get('cache-control'), 'no-store');

    const badProviderRes = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({ provider: 'unknown', apiKey: 'secret', text: 'Hallo OpenNews' }),
      }),
      {},
      TEST_DEPS,
    );
    assert.equal(badProviderRes.status, 400);
  });

  it('converts Google Gemini TTS base64 PCM response into RIFF WAVE audio', async () => {
    const pcm = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const base64 = Buffer.from(pcm).toString('base64');
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          provider: 'google',
          apiKey: 'secret',
          model: 'gemini-3.8-flash-lite-tts',
          voice: 'Kore',
          text: 'Nachrichten im Überblick.',
        }),
      }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ inlineData: { data: base64 } }] } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/wav');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(bytes.length, 44 + pcm.length);
    assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), 'RIFF');
    assert.equal(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]), 'WAVE');
  });

  it('proxies OpenAI TTS MP3 bytes with no-store headers', async () => {
    const mp3Stub = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00]);
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SAME_ORIGIN },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini-tts',
          voice: 'sage',
          text: 'Kurzmeldung am Morgen.',
        }),
      }),
      {},
      {
        ...TEST_DEPS,
        fetchImpl: async () =>
          new Response(mp3Stub, {
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' },
          }),
      },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), mp3Stub);
  });
});
