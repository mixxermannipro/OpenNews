import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle, NewsSource } from '../types/news';
import { STARTER_PACKS } from './catalog';
import {
  countDiscoverCategories,
  curateDiscoverFeed,
  extractLiveSearchSuggestions,
  searchDiscoverArticles,
  selectDiscoverSources,
  selectDiscoverStarterPacks,
} from './discoverEngine';

const NOW = Date.parse('2026-11-25T12:00:00Z');

function makeArticle(
  id: string,
  sourceId: string,
  title: string,
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary: 'Ausführliche Hintergrundanalyse zu aktuellen politischen und wirtschaftlichen Entwicklungen.',
    link: `https://example.org/${sourceId}/${id}`,
    sourceId,
    sourceName: sourceId.toUpperCase(),
    sourceColor: '#2563EB',
    sourceShortCode: sourceId.slice(0, 3).toUpperCase(),
    category: 'Politik',
    publishedAt: new Date(NOW - 30 * 60_000).toISOString(),
    readingTimeMin: 3,
    paragraphs: [],
    keywords: [],
    imageUrl: `https://cdn.example.org/${id}.jpg`,
    ...overrides,
  };
}

test('curateDiscoverFeed prevents single-source monoculture and excludes advertorials', () => {
  const articles: NewsArticle[] = [
    // 6 fresh articles from Deutschlandfunk in a row
    makeArticle('dlf-1', 'dlf', 'Bundestag debattiert Haushalt 2027', { publishedAt: new Date(NOW - 5 * 60_000).toISOString() }),
    makeArticle('dlf-2', 'dlf', 'Bahn plant neue Schnellstrecke nach München', { publishedAt: new Date(NOW - 6 * 60_000).toISOString() }),
    makeArticle('dlf-3', 'dlf', 'EZB hält Leitzins stabil', { publishedAt: new Date(NOW - 7 * 60_000).toISOString() }),
    makeArticle('dlf-4', 'dlf', 'Klima-Gipfel sucht Kompromiss', { publishedAt: new Date(NOW - 8 * 60_000).toISOString() }),
    makeArticle('dlf-5', 'dlf', 'Kommunen fordern mehr Investitionen', { publishedAt: new Date(NOW - 9 * 60_000).toISOString() }),
    // Diverse sources slightly older
    makeArticle('sp-1', 'spiegel', 'Verteidigungsetat steigt deutlich', { publishedAt: new Date(NOW - 20 * 60_000).toISOString() }),
    makeArticle('sz-1', 'sz', 'Autoindustrie drängt auf Reformen', { publishedAt: new Date(NOW - 25 * 60_000).toISOString() }),
    makeArticle('zeit-1', 'zeit', 'Bildungsgipfel in Berlin vertagt', { publishedAt: new Date(NOW - 30 * 60_000).toISOString() }),
    makeArticle('faz-1', 'faz', 'Industrieproduktion legt überraschend zu', { publishedAt: new Date(NOW - 35 * 60_000).toISOString() }),
    // Advertorial must be excluded completely
    makeArticle('ad-1', 'welt', 'Anzeige: Beste Krypto-Broker im Vergleich', { link: 'https://example.org/anzeige/broker' }),
  ];

  const curated = curateDiscoverFeed(articles, 'Alle', NOW);
  assert.ok(curated.every(a => a.id !== 'ad-1'));

  // Top 5 must come from 5 distinct sources (zero monoculture!)
  const top5Sources = new Set(curated.slice(0, 5).map(a => a.sourceId));
  assert.equal(top5Sources.size, 5);
});

test('searchDiscoverArticles handles umlauts, out-of-order multi-word queries, sorting, and media filter', () => {
  const articles: NewsArticle[] = [
    makeArticle('1', 'spiegel', 'Neue Zölle der USA belasten Exporte nach Österreich', {
      publishedAt: new Date(NOW - 2 * 3600_000).toISOString(),
    }),
    makeArticle('2', 'heise', 'Österreich baut KI-Rechenzentrum mit Video-Einblick', {
      publishedAt: new Date(NOW - 10 * 60_000).toISOString(),
      media: [{ type: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk' }],
    }),
    makeArticle('3', 'faz', 'USA und EU verhandeln über Handelsabkommen', {
      publishedAt: new Date(NOW - 5 * 60_000).toISOString(),
    }),
  ];

  // Out-of-order + umlaut folding ("Oesterreich" -> "Österreich", "USA Zoelle" -> "Zölle der USA")
  const multiWord = searchDiscoverArticles(articles, 'Oesterreich Zoelle USA', { nowMs: NOW });
  assert.deepEqual(multiWord.map(a => a.id), ['1']);

  // Newest sort orders article 2 ahead of article 1
  const newest = searchDiscoverArticles(articles, 'Oesterreich', { sort: 'newest', nowMs: NOW });
  assert.deepEqual(newest.map(a => a.id), ['2', '1']);

  // Media-only filter keeps only articles with playable media
  const mediaOnly = searchDiscoverArticles(articles, 'Oesterreich', { mediaOnly: true, nowMs: NOW });
  assert.deepEqual(mediaOnly.map(a => a.id), ['2']);
});

test('extractLiveSearchSuggestions mines multi-source entities and excludes category names', () => {
  const articles: NewsArticle[] = [
    makeArticle('1', 'tagesschau', 'Bundestag beschließt Reform der Pflegeversicherung'),
    makeArticle('2', 'spiegel', 'Debatte im Bundestag über Politik und Europa'),
    makeArticle('3', 'heise', 'Nvidia präsentiert neue Chips für Rechenzentren'),
    makeArticle('4', 'golem', 'Nvidia steigert Umsatz erneut kräftig'),
  ];

  const suggestions = extractLiveSearchSuggestions(articles, 'de', 6);
  assert.ok(suggestions.includes('Bundestag'));
  assert.ok(suggestions.includes('Nvidia'));
  assert.ok(!suggestions.includes('Politik'));
  assert.ok(!suggestions.includes('Europa'));
});

test('selectDiscoverSources prioritizes unsubscribed sources and matches active category', () => {
  const sources: NewsSource[] = [
    { id: 's1', name: 'Already Active', url: 'https://a.org/rss', format: 'rss', category: 'Wissenschaft', description: '', language: 'de', subscribed: true, recommended: true, accentColor: '#000', shortCode: 'AA' },
    { id: 's2', name: 'Spektrum Unsubscribed', url: 'https://b.org/rss', format: 'rss', category: 'Wissenschaft', description: '', language: 'de', subscribed: false, recommended: true, accentColor: '#000', shortCode: 'SP' },
    { id: 's3', name: 'English Global', url: 'https://c.org/rss', format: 'rss', category: 'Politik', description: '', language: 'en', subscribed: false, recommended: true, accentColor: '#000', shortCode: 'EG' },
    { id: 's4', name: 'Audio Podcast', url: 'https://d.org/pod.xml', format: 'podcast', category: 'Politik', description: '', language: 'de', subscribed: false, recommended: true, accentColor: '#000', shortCode: 'AP' },
  ];

  const discoverSci = selectDiscoverSources(sources, 'de', 'discover', 'Wissenschaft', 4);
  assert.equal(discoverSci[0]?.id, 's2');

  const intl = selectDiscoverSources(sources, 'de', 'international', 'Alle', 4);
  assert.deepEqual(intl.map(s => s.id), ['s3']);

  const media = selectDiscoverSources(sources, 'de', 'media', 'Alle', 4);
  assert.deepEqual(media.map(s => s.id), ['s4']);
});

test('countDiscoverCategories and selectDiscoverStarterPacks compute accurate counts', () => {
  const counts = countDiscoverCategories([
    makeArticle('1', 'a', 'Politik A', { category: 'Politik' }),
    makeArticle('2', 'b', 'Tech B', { category: 'Technologie' }),
    makeArticle('3', 'c', 'Anzeige: Promo', { category: 'Technologie', link: 'https://example.org/sponsored/x' }),
  ]);
  assert.equal(counts.Alle, 2);
  assert.equal(counts.Politik, 1);
  assert.equal(counts.Technologie, 1);

  const packs = selectDiscoverStarterPacks(STARTER_PACKS, 'de', new Set(['tagesschau', 'zdfheute']));
  assert.ok(packs.some(p => p.id === 'dach-core' && p.newCount === 5));
});
