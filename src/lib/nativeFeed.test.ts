import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SOURCES } from './catalog';
import { fetchNativeFeeds, publicHttpUrl } from './nativeFeed';

test('loads sources past 20 while one slow request is still pending', async () => {
  let finishSlow!: () => void;
  const slow = new Promise<void>(resolve => { finishSlow = resolve; });
  const feed = '<rss><channel><item><title>Nachricht</title><link>https://example.org/news</link></item></channel></rss>';
  const sources = DEFAULT_SOURCES.slice(0, 22);
  const received = new Set<string>();
  let foundLast!: () => void;
  const lastReceived = new Promise<void>(resolve => { foundLast = resolve; });
  const loadText = async (url: string) => {
    if (url === sources[0].url) await slow;
    if (url === sources[1].url) throw new Error('offline');
    return feed;
  };
  const loading = fetchNativeFeeds(sources, articles => {
    received.add(articles[0].sourceId);
    if (articles[0].sourceId === sources[21].id) foundLast();
  }, new AbortController().signal, loadText);

  const timeout = setTimeout(finishSlow, 500);
  try {
    await Promise.race([lastReceived, loading]);
    assert.ok(received.has(sources[21].id));
    assert.ok(!received.has(sources[0].id));
  } finally {
    clearTimeout(timeout);
    finishSlow();
    await loading;
  }
  assert.equal(received.size, 21);
});

test('checks public URLs before native fetch and removes fragments', () => {
  assert.equal(publicHttpUrl('https://example.org/rss#fragment'), 'https://example.org/rss');
  assert.equal(publicHttpUrl('https://1.1.1.1/rss'), 'https://1.1.1.1/rss');
  for (const host of ['localhost', '172.16.0.1', '100.64.0.1', '[fc00::1]', '[fe80::1]', '[::ffff:127.0.0.1]']) {
    assert.equal(publicHttpUrl(`https://${host}/rss`), null, host);
  }
});
