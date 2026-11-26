import http from 'node:http';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server.ts';
import { fetchPublicWithRedirects, readPublicTextFromResponse } from './apiCore.ts';
import { handlePagesApiRequest } from './pagesApi.ts';

interface AdapterCallResult {
  status: number;
  headers: Headers;
  json: () => Promise<Record<string, unknown>>;
}

interface ApiAdapter {
  name: string;
  call: (
    path: string,
    init: { method?: string; headers?: Record<string, string>; body?: string },
    mockFetch?: typeof fetch,
    optOutCsv?: string,
  ) => Promise<AdapterCallResult>;
}

const adapters: ApiAdapter[] = [
  {
    name: 'Cloudflare Pages',
    async call(path, init, mockFetch, optOutCsv) {
      const res = await handlePagesApiRequest(
        new Request(`https://opennews-app.pages.dev${path}`, init),
        { OPENNEWS_OPTOUT_DOMAINS: optOutCsv },
        {
          disableRateLimit: true,
          fetchImpl: mockFetch,
        },
      );
      return {
        status: res.status,
        headers: res.headers,
        json: () => res.json() as Promise<Record<string, unknown>>,
      };
    },
  },
  {
    name: 'Node Express',
    async call(path, init, mockFetch, optOutCsv) {
      const fetchImpl = mockFetch ?? (async () => new Response('', { status: 404 }));
      const app = createApp({
        disableRateLimit: true,
        runtimeDeps: {
          fetchPublic: (url, opts) => fetchPublicWithRedirects(url, opts, fetchImpl),
          readPublicText: (resp, maxBytes, opts) => readPublicTextFromResponse(resp, maxBytes, opts),
          optOutDomainsCsv: optOutCsv,
        },
      });
      const server = http.createServer(app);
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        throw new Error('Failed to bind test server');
      }
      try {
        const res = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
        return {
          status: res.status,
          headers: res.headers,
          json: () => res.json() as Promise<Record<string, unknown>>,
        };
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    },
  },
];

for (const adapter of adapters) {
  describe(`API Parity [${adapter.name}]`, () => {
    it('rejects requests without Origin or Sec-Fetch-Site: same-origin', async () => {
      const res = await adapter.call('/api/article/extract?url=https%3A%2F%2Fexample.org%2Fa', {});
      assert.equal(res.status, 403);
    });

    it('rejects invalid URLs and private IP targets cleanly', async () => {
      const badExtract = await adapter.call(
        '/api/article/extract?url=http%3A%2F%2F127.0.0.1%2Fadmin',
        { headers: { 'sec-fetch-site': 'same-origin' } },
      );
      assert.equal(badExtract.status, 400);

      const badCustomAi = await adapter.call(
        '/api/ai/proxy',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
          body: JSON.stringify({
            provider: 'custom',
            model: 'llama-3',
            apiKey: 'sk-test-1234567890',
            customEndpoint: 'http://192.168.1.1/v1/chat/completions',
            prompt: 'Test',
          }),
        },
      );
      assert.equal(badCustomAi.status, 400);
    });

    it('blocks redirects to private IPs on article extraction', async () => {
      const res = await adapter.call(
        '/api/article/extract?url=https%3A%2F%2Fexample.org%2Fredirect',
        { headers: { 'sec-fetch-site': 'same-origin' } },
        async () => new Response(null, { status: 302, headers: { Location: 'http://10.0.0.1/secret' } }),
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).unavailable, true);
    });

    it('enforces oversized response limits cleanly', async () => {
      const hugeChunk = new Uint8Array(3 * 1024 * 1024);
      const res = await adapter.call(
        '/api/article/extract?url=https%3A%2F%2Fexample.org%2Fhuge',
        { headers: { 'sec-fetch-site': 'same-origin' } },
        async () => new Response(hugeChunk, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).unavailable, true);
    });

    it('blocks paywall markup, X-Robots-Tag noarchive/noai, and publisher opt-outs', async () => {
      const optOutRes = await adapter.call(
        '/api/article/extract?url=https%3A%2F%2Fnews.blocked.de%2F1',
        { headers: { 'sec-fetch-site': 'same-origin' } },
        undefined,
        'blocked.de',
      );
      assert.equal(optOutRes.status, 200);
      const optOutData = await optOutRes.json();
      assert.equal(optOutData.unavailable, true);
      assert.equal(optOutData.optOut, true);

      const noArchiveRes = await adapter.call(
        '/api/article/extract?url=https%3A%2F%2Fexample.org%2Fnoarchive',
        { headers: { 'sec-fetch-site': 'same-origin' } },
        async () =>
          new Response('<article><p>Text</p></article>', {
            status: 200,
            headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noarchive' },
          }),
      );
      assert.equal(noArchiveRes.status, 200);
      assert.equal((await noArchiveRes.json()).unavailable, true);

      const paywallRes = await adapter.call(
        '/api/article/extract?url=https%3A%2F%2Fexample.org%2Fpaywall',
        { headers: { 'sec-fetch-site': 'same-origin' } },
        async () =>
          new Response(
            '<html><head><script type="application/ld+json">{"isAccessibleForFree":false}</script></head><body><p>Teaser</p></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } },
          ),
      );
      assert.equal(paywallRes.status, 200);
      const paywallData = await paywallRes.json();
      assert.equal(paywallData.unavailable, true);
      assert.equal(paywallData.blockedWall, true);
    });

    it('never logs or leaks API keys in logs or error payloads', async () => {
      const secretGoogle = 'AIzaSySECRET_DO_NOT_LOG_1234567890';
      const secretOpenAi = 'sk-proj-SECRET_DO_NOT_LOG_1234567890';
      const capturedLogs: string[] = [];
      const origInfo = console.info;
      const origWarn = console.warn;
      const origError = console.error;
      const origLog = console.log;
      const capture = (...args: unknown[]) => capturedLogs.push(args.map(String).join(' '));
      console.info = capture;
      console.warn = capture;
      console.error = capture;
      console.log = capture;

      try {
        const aiRes = await adapter.call(
          '/api/ai/proxy',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
            body: JSON.stringify({
              provider: 'google',
              model: 'gemini-flash-latest',
              apiKey: secretGoogle,
              prompt: 'Test',
            }),
          },
          async () =>
            new Response(JSON.stringify({ error: { message: `Invalid key ${secretGoogle}` } }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
        );
        assert.equal(aiRes.status, 401);
        const aiBody = JSON.stringify(await aiRes.json());
        assert.equal(aiBody.includes(secretGoogle), false);

        const ttsRes = await adapter.call(
          '/api/tts/proxy',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
            body: JSON.stringify({
              provider: 'openai',
              model: 'gpt-4o-mini-tts',
              apiKey: secretOpenAi,
              text: 'Test audio',
            }),
          },
          async () => new Response('Unauthorized', { status: 401 }),
        );
        assert.equal(ttsRes.status, 401);
        const ttsBody = JSON.stringify(await ttsRes.json());
        assert.equal(ttsBody.includes(secretOpenAi), false);

        const joinedLogs = capturedLogs.join('\n');
        assert.equal(joinedLogs.includes(secretGoogle), false);
        assert.equal(joinedLogs.includes(secretOpenAi), false);
      } finally {
        console.info = origInfo;
        console.warn = origWarn;
        console.error = origError;
        console.log = origLog;
      }
    });
  });
}
