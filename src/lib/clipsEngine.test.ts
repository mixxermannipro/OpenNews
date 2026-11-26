import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle, NewsSource } from '../types/news';
import { STARTER_PACKS } from './catalog';
import {
  buildClipsPlaylist,
  extractContinueListening,
  extractMediaChannels,
  filterMediaEntries,
  formatDurationLabel,
  formatMediaTime,
  getClipRenderState,
  interleaveClipsBySource,
  isDoubleTap,
  resolveClipStep,
  selectMediaDiscoverySources,
  selectMediaStarterPacks,
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

  // Tab-aware channel filtering prevents video channels showing under Audio tab
  const audioChannels = extractMediaChannels(entries, 'audio');
  assert.deepEqual(audioChannels.map(c => c.sourceId), ['npr']);

  const videoChannels = extractMediaChannels(entries, 'video');
  assert.deepEqual(videoChannels.map(c => c.sourceId), ['brut']);
});

test('extractContinueListening returns unfinished audio sorted by most recently heard', () => {
  const ep1 = makeEntry('ep1', 'ldn', { type: 'audio' });
  ep1.media.durationSec = 1800;
  const ep2 = makeEntry('ep2', 'npr', { type: 'audio' });
  ep2.media.durationSec = 900;
  const epDone = makeEntry('ep3', 'dlf', { type: 'audio' });
  epDone.media.durationSec = 600;
  const video = makeEntry('v1', 'bbc', { type: 'youtube' });

  const positions = {
    [ep1.media.url]: { url: ep1.media.url, seconds: 420, duration: 1800, updatedAt: 1000 },
    [ep2.media.url]: { url: ep2.media.url, seconds: 120, duration: 900, updatedAt: 2000 },
    [epDone.media.url]: { url: epDone.media.url, seconds: 595, duration: 600, updatedAt: 3000 }, // finished
    [video.media.url]: { url: video.media.url, seconds: 80, duration: 300, updatedAt: 4000 }, // not audio
  };

  const list = extractContinueListening([ep1, ep2, epDone, video], positions);
  assert.deepEqual(list.map(item => item.entry.article.id), ['ep2', 'ep1']);
  assert.equal(list[0].remainingSec, 780);
  assert.equal(list[1].progressPct, 23);
});

test('filterMediaEntries matches multi-word umlaut-folded queries and formatDurationLabel handles edge values', () => {
  const e1 = makeEntry('a1', 'ldn', { type: 'audio' });
  e1.article.title = 'Österreich und die Energiewende';
  const e2 = makeEntry('a2', 'zdf', { type: 'youtube' });
  e2.article.title = 'Künstliche Intelligenz im Alltag';

  const matches = filterMediaEntries([e1, e2], 'Oesterreich Energie');
  assert.deepEqual(matches.map(m => m.article.id), ['a1']);

  assert.equal(formatDurationLabel(undefined), undefined);
  assert.equal(formatDurationLabel(0), undefined);
  assert.equal(formatDurationLabel(865), '14:25');
});

test('selectMediaDiscoverySources and selectMediaStarterPacks prioritize unsubscribed language-matched channels', () => {
  const mockSources: NewsSource[] = [
    { id: 'pod-de', name: 'DACH Pod', url: 'https://example.org/pod.xml', format: 'podcast', category: 'Politik', description: '', language: 'de', subscribed: false, recommended: true, accentColor: '#000', shortCode: 'DP', tags: ['podcast', 'audio'] },
    { id: 'pod-de-sub', name: 'Subscribed Pod', url: 'https://example.org/pod2.xml', format: 'podcast', category: 'Politik', description: '', language: 'de', subscribed: true, recommended: true, accentColor: '#000', shortCode: 'SP', tags: ['podcast', 'audio'] },
    { id: 'vid-de', name: 'DACH Video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=123', format: 'podcast', category: 'Politik', description: '', language: 'de', subscribed: false, recommended: true, accentColor: '#000', shortCode: 'DV', tags: ['video', 'youtube'] },
  ];

  assert.deepEqual(selectMediaDiscoverySources(mockSources, 'de', 'audio').map(s => s.id), ['pod-de']);
  assert.deepEqual(selectMediaDiscoverySources(mockSources, 'de', 'video').map(s => s.id), ['vid-de']);

  const deAudioPacks = selectMediaStarterPacks(STARTER_PACKS, 'de', 'audio');
  assert.equal(deAudioPacks[0]?.id, 'podcasts-dach');

  const enAudioPacks = selectMediaStarterPacks(STARTER_PACKS, 'en', 'audio');
  assert.ok(enAudioPacks.every(p => p.id !== 'podcasts-dach'));
});
