import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import {
  articleMatchesKeyword,
  buildKeywordRadarMatches,
  createMuteRule,
  filterMutedArticles,
  pruneExpiredMutes,
} from './keywordFilter';

function makeArticle(id: string, title: string, summary = ''): NewsArticle {
  return {
    id,
    sourceId: 's1',
    sourceName: 'Source',
    sourceShortCode: 'SR',
    sourceColor: '#111',
    title,
    summary,
    paragraphs: [],
    link: `https://example.org/${id}`,
    category: 'Politik',
    publishedAt: '2026-11-20T10:00:00Z',
    readingTimeMin: 2,
    keywords: [],
  };
}

test('articleMatchesKeyword normalizes umlauts and accents while avoiding false short matches', () => {
  const art = makeArticle('1', 'Neue Fördermittel für Wasserstoff-Projekte in München');
  assert.equal(articleMatchesKeyword(art, 'Wasserstoff'), true);
  assert.equal(articleMatchesKeyword(art, 'muenchen'), true);
  assert.equal(articleMatchesKeyword(art, 'Foerdermittel'), true);
  assert.equal(articleMatchesKeyword(art, 'gen'), false);
});

test('filterMutedArticles hides active muted keywords and respects expiration', () => {
  const now = 1_000_000;
  const expired = createMuteRule('Bundestag', '24h', now - 25 * 3600 * 1000)!;
  const active = createMuteRule('Boulevard', '7d', now)!;
  assert.equal(pruneExpiredMutes([expired, active], now).length, 1);

  const items = [
    makeArticle('1', 'Bundestag debattiert Haushalt'),
    makeArticle('2', 'Boulevard-Streit um TV-Show'),
  ];
  const visible = filterMutedArticles(items, [expired, active], now);
  assert.deepEqual(visible.map(i => i.id), ['1']);
});

test('buildKeywordRadarMatches groups matching articles per tracked keyword', () => {
  const items = [
    makeArticle('1', 'EU-KI-Gesetz tritt in Kraft', 'Unternehmen müssen Modelle kennzeichnen.'),
    makeArticle('2', 'Wasserstoffnetz im Norden wächst'),
  ];
  const radar = buildKeywordRadarMatches(items, ['KI-Gesetz', 'Wasserstoff', 'Mars']);
  assert.equal(radar.length, 3);
  assert.equal(radar[0].articles.length, 1);
  assert.equal(radar[1].articles.length, 1);
  assert.equal(radar[2].articles.length, 0);
});
