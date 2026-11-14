import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCategory, parseFeedPayload, stripHtml, estimateReadingTime } from './rssParser';
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

test('collects RSS media, resolves relative URLs and removes duplicates and unsafe sources', () => {
  const [article] = parseFeedPayload(`<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item>
    <title>Medienbeitrag</title><link>https://example.org/news/story</link>
    <enclosure url="../episode.mp3" type="audio/mpeg" />
    <media:group><media:content url="https://example.org/episode.mp3" medium="audio" />
      <media:content url="/video.mp4" medium="video" /><media:content url="/photo.jpg" medium="image" />
    </media:group>
    <description><![CDATA[<p>Ein Artikel mit mehreren Medien.</p>
      <audio><source src="/voice.opus"></audio>
      <video src="javascript:alert(1)"></video>
      <iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>
      <iframe src="https://example.org/youtube.com/embed/aqz-KE-bpKQ"></iframe>
    ]]></description>
  </item></channel></rss>`, mockSource);
  assert.deepEqual(article.media?.map(({ type, url }) => [type, url]), [
    ['audio', 'https://example.org/episode.mp3'],
    ['video', 'https://example.org/video.mp4'],
    ['image', 'https://example.org/photo.jpg'],
    ['audio', 'https://example.org/voice.opus'],
    ['youtube', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'],
  ]);
});

test('collects every Atom enclosure and JSON attachment', () => {
  const [atom] = parseFeedPayload(`<feed><entry><title>Atom</title>
    <link href="https://example.org/article" />
    <link rel="enclosure" href="/cover.jpg" type="image/jpeg" />
    <link rel="enclosure" href="/audio.mp3" type="audio/mpeg" />
    <link rel="enclosure" href="/video.webm" type="video/webm" />
  </entry></feed>`, mockSource);
  assert.deepEqual(atom.media?.map(media => media.type), ['image', 'audio', 'video']);
  assert.equal(atom.imageUrl, 'https://example.org/cover.jpg');
  const [json] = parseFeedPayload(JSON.stringify({ items: [{
    title: 'JSON', url: 'https://example.org/article',
    attachments: [
      null,
      { url: '/one.mp3', mime_type: 'audio/mpeg' },
      { url: '/two.mp3', mime_type: 'audio/mpeg' },
    ],
  }] }), mockSource);
  assert.equal(json.media?.length, 2);
});

test('does not use an untyped video as the article image', () => {
  const [article] = parseFeedPayload(`<rss><channel><item>
    <title>Video</title><media:content url="https://example.org/clip.mp4" />
    <media:thumbnail url="https://example.org/poster.jpg" />
  </item></channel></rss>`, mockSource);
  assert.equal(article.imageUrl, 'https://example.org/poster.jpg');
  assert.equal(article.videoUrl, 'https://example.org/clip.mp4');
});

test('keeps the portrait format for YouTube Shorts and portrait feed videos', () => {
  const xml = `<rss><channel><item><title>Kurznachrichten</title>
    <link>https://www.youtube.com/shorts/abcdefghijk</link>
    <media:content url="https://example.org/clip.mp4" type="video/mp4" width="720" height="1280" />
  </item></channel></rss>`;
  const [article] = parseFeedPayload(xml, mockSource);
  assert.equal(article.media?.find(item => item.type === 'youtube')?.portrait, true);
  assert.equal(article.media?.find(item => item.type === 'video')?.portrait, true);
});

test('decodes hexadecimal entities and keeps unlinked RSS entries distinct', () => {
  const articles = parseFeedPayload('<rss><channel><item><title>Someone&amp;#x27;s report</title></item><item><title>Another report</title></item></channel></rss>', mockSource);
  assert.equal(articles[0].title, "Someone's report");
  assert.notEqual(articles[0].id, articles[1].id);
});

test('parses the thumbnail, description and portrait link from a YouTube channel feed', () => {
  const [article] = parseFeedPayload(`<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
    <entry><id>yt:video:tLm6NC0tkt0</id><title>Tagesschau Clip</title>
      <link rel="alternate" href="https://www.youtube.com/shorts/tLm6NC0tkt0"/>
      <media:group>
        <media:thumbnail url="https://i.ytimg.com/vi/tLm6NC0tkt0/hqdefault.jpg"/>
        <media:description>Nachrichten im Hochformat</media:description>
      </media:group>
    </entry>
  </feed>`, mockSource);
  assert.equal(article.imageUrl, 'https://i.ytimg.com/vi/tLm6NC0tkt0/hqdefault.jpg');
  assert.equal(article.summary, 'Nachrichten im Hochformat');
  assert.equal(article.media?.find(media => media.type === 'youtube')?.portrait, true);
});

test('prefers a known publisher section and recognizes political titles about athletes', () => {
  assert.equal(inferCategory([{ '#text': 'Sport' }], 'Verein bittet Minister um Unterstützung', '', 'Gesellschaft'), 'Sport');
  assert.equal(inferCategory(undefined, 'Steinmeier-Nachfolge: AfD nominiert Fußballer', 'Der ehemalige Spieler war in der Bundesliga.', 'Gesellschaft'), 'Politik');
  assert.equal(inferCategory('International', 'Tanker kollidiert bei New Orleans', '', 'Europa'), 'Europa');
});
