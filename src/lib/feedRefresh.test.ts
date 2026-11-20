import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsSource } from '../types/news';
import { planFeedBatches, runWithConcurrency } from './feedRefresh';

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
