import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import {
  buildClipsPlaylist,
  extractMediaChannels,
  formatMediaTime,
  getClipRenderState,
  interleaveClipsBySource,
  isDoubleTap,
  resolveClipStep,
  type MediaEntry,
} from './clipsEngine';

function makeEntry(id: string, sourceId: string, opts: { portrait?: boolean; type?: 'video' | 'youtube' | 'audio' } = {}): MediaEntry {
  const article: NewsArticle = {
    id,
    title: `Clip ${id}`,
    summary: `Summary for ${id}`,
    link: `https://example.com/${id}`,
    sourceId,
    sourceName: sourceId.toUpperCase(),
    sourceColor: '#2563EB',
    sourceShortCode: sourceId.slice(0, 3).toUpperCase(),
    category: 'Politik',
    publishedAt: '2026-11-20T10:00:00Z',
    readingTimeMin: 1,
    paragraphs: [],
    keywords: [],
  };
  return {
    article,
    media: {
      type: opts.type ?? 'youtube',
      url: `https://www.youtube-nocookie.com/embed/${id.padEnd(11, '0')}`,
      portrait: opts.portrait ?? false,
    },
  };
}

test('interleaveClipsBySource mixes channels so consecutive clips come from different sources', () => {
  const input = [
    makeEntry('a1', 'bbc', { portrait: true }),
    makeEntry('a2', 'bbc', { portrait: true }),
    makeEntry('a3', 'bbc', { portrait: true }),
    makeEntry('b1', 'vox', { portrait: true }),
    makeEntry('b2', 'vox', { portrait: true }),
    makeEntry('c1', 'brut', { portrait: true }),
  ];
  const mixed = interleaveClipsBySource(input);
  assert.deepEqual(
    mixed.map(item => item.article.id),
    ['a1', 'b1', 'c1', 'a2', 'b2', 'a3'],
  );
});

test('buildClipsPlaylist prioritizes portrait clips and falls back cleanly to videos when none exist', () => {
  const shortsAndVideos = [
    makeEntry('v1', 'bbc', { portrait: false, type: 'youtube' }),
    makeEntry('s1', 'vox', { portrait: true, type: 'youtube' }),
    makeEntry('p1', 'npr', { portrait: false, type: 'audio' }),
    makeEntry('s2', 'brut', { portrait: true, type: 'video' }),
  ];

  const shortsOnly = buildClipsPlaylist(shortsAndVideos, 'shorts');
  assert.equal(shortsOnly.hasDedicatedShorts, true);
  assert.equal(shortsOnly.usingFallback, false);
  assert.deepEqual(shortsOnly.items.map(i => i.article.id), ['s1', 's2']);

  const allVideo = buildClipsPlaylist(shortsAndVideos, 'all-video');
  assert.equal(allVideo.items.length, 3);
  assert.ok(allVideo.items.every(i => i.media.type !== 'audio'));

  const noShorts = [makeEntry('v1', 'bbc', { portrait: false }), makeEntry('p1', 'npr', { type: 'audio' })];
  const fallback = buildClipsPlaylist(noShorts, 'shorts', true);
  assert.equal(fallback.hasDedicatedShorts, false);
  assert.equal(fallback.usingFallback, true);
  assert.equal(fallback.items.length, 1);
});

test('getClipRenderState keeps only active slide live and adjacent +-1 nearby', () => {
  assert.equal(getClipRenderState(2, 2), 'active');
  assert.equal(getClipRenderState(1, 2), 'nearby');
  assert.equal(getClipRenderState(3, 2), 'nearby');
  assert.equal(getClipRenderState(0, 2), 'idle');
  assert.equal(getClipRenderState(4, 2), 'idle');
});

test('isDoubleTap, resolveClipStep, and formatMediaTime behave deterministically', () => {
  assert.equal(isDoubleTap(1000, 1200), true);
  assert.equal(isDoubleTap(1000, 1450), false);
  assert.equal(isDoubleTap(0, 100), false);

  assert.equal(resolveClipStep(0, -1, 5), 0);
  assert.equal(resolveClipStep(4, 1, 5), 4);
  assert.equal(resolveClipStep(2, 1, 5), 3);

  assert.equal(formatMediaTime(0), '0:00');
  assert.equal(formatMediaTime(65), '1:05');
  assert.equal(formatMediaTime(3725), '1:02:05');
});

test('extractMediaChannels groups sources and ranks clip-bearing channels first', () => {
  const entries = [
    makeEntry('a1', 'npr', { type: 'audio' }),
    makeEntry('a2', 'npr', { type: 'audio' }),
    makeEntry('s1', 'brut', { portrait: true }),
    makeEntry('s2', 'brut', { portrait: true }),
  ];
  const channels = extractMediaChannels(entries);
  assert.equal(channels[0].sourceId, 'brut');
  assert.equal(channels[0].hasClips, true);
  assert.equal(channels[1].sourceId, 'npr');
  assert.equal(channels[1].hasAudio, true);
});
