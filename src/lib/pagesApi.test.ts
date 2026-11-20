import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handlePagesApiRequest } from './pagesApi.ts';

describe('handlePagesApiRequest', () => {
  it('returns health status', async () => {
    const res = await handlePagesApiRequest(new Request('https://opennews-app.pages.dev/api/health'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      ok: true,
      service: 'OpenNews',
      runtime: 'cloudflare-pages',
    });
  });

  it('rejects cross-origin requests when origin mismatches', async () => {
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/health', {
        headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      }),
    );
    assert.equal(res.status, 403);
  });

  it('fetches and parses RSS feeds', async () => {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeds: [{ id: 'test-src', name: 'Test', url: 'https://example.org/rss.xml', format: 'rss', category: 'Welt' }],
        }),
      }),
      {},
      {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeds: [{ id: 'local', name: 'Local', url: 'http://127.0.0.1/feed.xml', format: 'rss', category: 'Welt' }],
        }),
      }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { feedStatuses: Array<{ ok: boolean }> };
    assert.equal(data.feedStatuses[0].ok, false);
  });

  it('discovers alternate RSS links from HTML', async () => {
    const html = `<html><head><link rel="alternate" type="application/rss+xml" title="Mein Feed" href="/feed.xml"></head></html>`;
    const res = await handlePagesApiRequest(
      new Request('https://opennews-app.pages.dev/api/feeds/discover?q=example.org'),
      {},
      {
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
      new Request('https://opennews-app.pages.dev/api/article/extract?url=https%3A%2F%2Fexample.org%2Fa'),
      {},
      {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', model: 'gemini-2.5-flash', prompt: 'Hi' }),
      }),
    );
    assert.equal(res.status, 400);
  });
});
