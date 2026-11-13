import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedPayload, stripHtml, estimateReadingTime } from './rssParser';
import type { NewsSource } from '../types/news';

const mockSource: NewsSource = {
  id: 'tagesschau',
  name: 'Tagesschau',
  url: 'https://www.tagesschau.de/xml/rss2/',
  format: 'rss',
  category: 'Politik',
  description: 'Test',
  language: 'de',
  subscribed: true,
  accentColor: '#3B82F6',
  shortCode: 'TS',
};

test('parses RSS 2.0 XML with media:content image and German entities', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
    <channel>
      <title>Tagesschau</title>
      <item>
        <title>Bundestag beschließt &amp; reformiert Energiegesetz</title>
        <link>https://www.tagesschau.de/inland/test-101.html</link>
        <guid>test-guid-1</guid>
        <pubDate>Thu, 12 Nov 2026 10:00:00 GMT</pubDate>
        <description>&lt;p&gt;Erster Absatz mit wichtigen Informationen über erneuerbare Energien.&lt;/p&gt;</description>
        <media:content url="https://www.tagesschau.de/image/101.jpg" medium="image" />
      </item>
    </channel>
  </rss>`;

  const articles = parseFeedPayload(xml, mockSource);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Bundestag beschließt & reformiert Energiegesetz');
  assert.equal(articles[0].imageUrl, 'https://www.tagesschau.de/image/101.jpg');
  assert.equal(articles[0].category, 'Politik');
  assert.ok(articles[0].summary.includes('wichtigen Informationen'));
});

test('parses Atom 1.0 feed with link enclosure video', () => {
  const atom = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>Heise</title>
    <entry>
      <id>urn:uuid:heise-1</id>
      <title>Neue KI-Chips vorgestellt</title>
      <updated>2026-11-12T12:00:00Z</updated>
      <link rel="alternate" href="https://www.heise.de/news/1.html" />
      <link rel="enclosure" type="video/mp4" href="https://www.heise.de/video/demo.mp4" />
      <summary>Ein Blick auf moderne Halbleiter und Software.</summary>
    </entry>
  </feed>`;

  const atomSource: NewsSource = { ...mockSource, id: 'heise', name: 'heise online', format: 'atom', category: 'Technologie' };
  const articles = parseFeedPayload(atom, atomSource);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].videoUrl, 'https://www.heise.de/video/demo.mp4');
  assert.equal(articles[0].category, 'Technologie');
});

test('parses JSON Feed 1.1 payload', () => {
  const jsonFeed = JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Hacker News',
    items: [
      {
        id: 'hn-42',
        url: 'https://news.ycombinator.com/item?id=42',
        title: 'Local AI on Smartphones',
        content_html: '<p>Running fast models locally on mobile devices.</p>',
        date_published: '2026-11-12T11:30:00Z',
        image: 'https://example.com/chip.jpg',
      },
    ],
  });

  const hnSource: NewsSource = { ...mockSource, id: 'hackernews', name: 'Hacker News', format: 'json', category: 'Technologie', language: 'en' };
  const articles = parseFeedPayload(jsonFeed, hnSource);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Local AI on Smartphones');
  assert.equal(articles[0].imageUrl, 'https://example.com/chip.jpg');
});

test('stripHtml and estimateReadingTime produce clean outputs', () => {
  const cleaned = stripHtml('<p>Hallo &amp; Welt</p><script>alert(1)</script><p>Zweiter Satz.</p>');
  assert.ok(!cleaned.includes('alert(1)'));
  assert.ok(cleaned.includes('Hallo & Welt'));
  assert.equal(estimateReadingTime('wort '.repeat(360)), 2);
});
