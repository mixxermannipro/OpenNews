import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle, NewsSource } from '../types/news';
import { STARTER_PACKS } from './catalog';
import { planFeedBatches, runWithConcurrency, selectHomeStarterPacks, slimFeedArticle } from './feedRefresh';

function makeSource(id: string, overrides: Partial<NewsSource> = {}): NewsSource {
  return {
    id,
    name: id,
    url: `https://example.org/${id}.xml`,
    format: 'rss',
    category: 'Politik',
    description: '',
    language: 'de',
    subscribed: true,
    accentColor: '#000',
    shortCode: id.slice(0, 3).toUpperCase(),
    ...overrides,
  };
}

test('planFeedBatches prioritizes recommended news sources into the fast first batch', () => {
  const sources: NewsSource[] = [
    makeSource('pod-1', { format: 'podcast' }),
    makeSource('news-1'),
    makeSource('rec-1', { recommended: true }),
    makeSource('custom-1', { isCustom: true }),
    makeSource('rec-2', { recommended: true }),
    makeSource('news-2'),
    makeSource('news-3'),
    makeSource('news-4'),
  ];

  const batches = planFeedBatches(sources, 4, 8);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 4);
  assert.equal(batches[1].length, 4);
  // Custom & recommended news should come before podcasts
  assert.ok(batches[0].some(s => s.id === 'custom-1'));
  assert.ok(batches[0].some(s => s.id === 'rec-1'));
  assert.ok(batches[0].some(s => s.id === 'rec-2'));
  assert.ok(batches[1].some(s => s.id === 'pod-1'));
});

test('runWithConcurrency bounds in-flight workers and honors early stop', async () => {
  let active = 0;
  let maxActive = 0;
  const visited: number[] = [];

  await runWithConcurrency([1, 2, 3, 4, 5], 2, async item => {
    active++;
    maxActive = Math.max(maxActive, active);
    visited.push(item);
    await new Promise(resolve => setTimeout(resolve, 10));
    active--;
    if (item === 2) return true;
  });

  assert.ok(maxActive <= 2);
  assert.ok(visited.includes(1) && visited.includes(2));
  assert.ok(visited.length < 5);
});

test('slimFeedArticle caps oversized paragraphs and deduplicates identical single-paragraph summary', () => {
  const longText = 'A'.repeat(900);
  const bloated: NewsArticle = {
    id: '1',
    sourceId: 's',
    sourceName: 'Source',
    sourceShortCode: 'SR',
    sourceColor: '#111',
    title: 'Headline',
    summary: longText,
    paragraphs: Array.from({ length: 12 }, () => longText),
    link: 'https://example.org/1',
    category: 'Politik',
    publishedAt: '2026-11-26T10:00:00Z',
    readingTimeMin: 3,
    keywords: [],
  };
  const slim = slimFeedArticle(bloated);
  assert.equal(slim.summary.length, 520);
  assert.equal(slim.paragraphs.length, 6);
  assert.equal(slim.paragraphs[0].length, 500);

  const dupSummary = slimFeedArticle({
    ...bloated,
    summary: 'Kurzer Anreißer.',
    paragraphs: ['Kurzer Anreißer.'],
  });
  assert.deepEqual(dupSummary.paragraphs, []);
});

test('selectHomeStarterPacks always places written news packs ahead of podcast or video packs', () => {
  const dePacks = selectHomeStarterPacks(STARTER_PACKS, 'de', 4);
  assert.equal(dePacks[0].id, 'dach-core');
  assert.equal(dePacks.some(pack => pack.id.startsWith('podcasts-') || pack.id.startsWith('clips-')), false);

  const enPacks = selectHomeStarterPacks(STARTER_PACKS, 'en', 4);
  assert.equal(enPacks[0].id, 'en-global');
});
