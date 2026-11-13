import assert from 'node:assert/strict';
import test from 'node:test';
import { exportOpml, importOpml } from './opml';

test('round trips nested OPML, escaped text and custom formats', () => {
  const sources = importOpml('<opml><body><outline text="Gruppe"><outline text="KI &amp; Technik" type="atom" xmlUrl="https://example.org/feed?a=1&amp;b=2"/><outline xmlUrl="https://example.org/feed?a=1&amp;b=2"/></outline></body></opml>');
  assert.equal(sources.length, 1);
  const [source] = importOpml(exportOpml([{ ...sources[0], name: 'KI & Technik', format: 'atom' }]));
  assert.equal(source.name, 'KI & Technik');
  assert.equal(source.format, 'atom');
  assert.equal(source.url, 'https://example.org/feed?a=1&b=2');
});

test('rejects non-OPML and ignores credentials in feed URLs', () => {
  assert.throws(() => importOpml('<html/>'));
  assert.deepEqual(importOpml('<opml><body><outline xmlUrl="https://user:pass@example.org/feed"/></body></opml>'), []);
});
