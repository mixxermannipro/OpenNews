import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import {
  buildSpeechBlocks,
  estimateQueueMinutes,
  exportHighlightsMarkdown,
  filterUnreadStories,
  resolveNeighborArticles,
  selectArticlesToPreload,
  selectFreeAlternatives,
  shouldPreloadOffline,
  upsertAudioPosition,
  upsertReadingProgress,
} from './readerExtras';

function makeArticle(id: string, link: string, readingTimeMin = 3): NewsArticle {
  return {
    id,
    sourceId: 's',
    sourceName: 'Source',
    sourceShortCode: 'SR',
    sourceColor: '#111',
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    paragraphs: [],
    link,
    category: 'Politik',
    publishedAt: '2026-11-20T10:00:00Z',
    readingTimeMin,
    keywords: [],
  };
}

test('buildSpeechBlocks maps title, lead, and body paragraphs accurately for synchronized highlighting', () => {
  const blocks = buildSpeechBlocks('Überschrift', 'Einleitungssatz.', ['Absatz eins.', '', 'Absatz zwei.']);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].kind, 'title');
  assert.equal(blocks[1].kind, 'lead');
  assert.deepEqual(blocks[2], { id: 'body-0', kind: 'body', bodyIndex: 0, text: 'Absatz eins.' });
  assert.deepEqual(blocks[3], { id: 'body-2', kind: 'body', bodyIndex: 2, text: 'Absatz zwei.' });
});

test('selectArticlesToPreload prioritizes saved items and skips cached, feed-only, or media-only entries', () => {
  const saved = [makeArticle('s1', 'https://a.de/saved-1')];
  const today = [
    makeArticle('t1', 'https://a.de/cached'),
    { ...makeArticle('t-vid', 'https://a.de/video-1'), videoUrl: 'https://a.de/video.mp4' },
    { ...makeArticle('t-pod', 'https://a.de/podcast-1'), audioUrl: 'https://a.de/audio.mp3' },
    makeArticle('t2', 'https://a.de/today-1'),
    { ...makeArticle('t3', 'https://a.de/feed-only'), linkIsFeed: true },
  ];
  const picks = selectArticlesToPreload(today, saved, new Set(['https://a.de/cached']), 5);
  assert.deepEqual(picks.map(a => a.id), ['s1', 't2']);
  assert.equal(estimateQueueMinutes([makeArticle('a', 'https://a.de/1', 4), makeArticle('b', 'https://a.de/2', 3)]), 7);
});

test('shouldPreloadOffline respects online state, saveData, and slow networks', () => {
  assert.equal(shouldPreloadOffline(false), false);
  assert.equal(shouldPreloadOffline(true, { saveData: true }), false);
  assert.equal(shouldPreloadOffline(true, { effectiveType: '2g' }), false);
  assert.equal(shouldPreloadOffline(true, { effectiveType: '4g', saveData: false }), true);
});

test('upsertAudioPosition persists playback time and clears completed tracks', () => {
  let map = upsertAudioPosition({}, 'https://audio/1.mp3', 124.7, 600, 1000);
  assert.equal(map['https://audio/1.mp3'].seconds, 124);
  map = upsertAudioPosition(map, 'https://audio/1.mp3', 580, 600, 2000);
  assert.equal(map['https://audio/1.mp3'], undefined);
});

test('upsertReadingProgress ignores shallow scrolls, clears finished articles, and caps stored entries', () => {
  let map = upsertReadingProgress({}, 'a1', 0.08, 1000);
  assert.equal(map.a1, undefined);

  map = upsertReadingProgress(map, 'a1', 0.456, 2000);
  assert.equal(map.a1?.ratio, 0.46);

  map = upsertReadingProgress(map, 'a2', 0.5, 3000, 2);
  map = upsertReadingProgress(map, 'a3', 0.6, 4000, 2);
  assert.deepEqual(Object.keys(map).sort(), ['a2', 'a3']);

  map = upsertReadingProgress(map, 'a2', 0.94, 5000, 2);
  assert.equal(map.a2, undefined);
});

test('resolveNeighborArticles locates previous and next articles accurately', () => {
  const list = [
    makeArticle('a1', 'https://a.de/1'),
    makeArticle('a2', 'https://a.de/2'),
    makeArticle('a3', 'https://a.de/3'),
  ];
  const mid = resolveNeighborArticles('a2', list);
  assert.equal(mid.previous?.id, 'a1');
  assert.equal(mid.next?.id, 'a3');
  assert.equal(mid.index, 1);
  assert.equal(mid.total, 3);

  const first = resolveNeighborArticles('a1', list);
  assert.equal(first.previous, undefined);
  assert.equal(first.next?.id, 'a2');

  const missing = resolveNeighborArticles('unknown', list);
  assert.equal(missing.index, -1);
  assert.equal(missing.previous, undefined);
});

test('selectFreeAlternatives excludes current publisher and ranks richest distinct sources first', () => {
  const current = { ...makeArticle('cur', 'https://pay.de/1'), sourceId: 'paywall' };
  const sameSource = { ...makeArticle('same', 'https://pay.de/2'), sourceId: 'paywall' };
  const shortFree = { ...makeArticle('short', 'https://short.de/1'), sourceId: 's1', summary: 'Kurz.' };
  const richFree = {
    ...makeArticle('rich', 'https://rich.de/1'),
    sourceId: 's2',
    summary: 'Ausführliche Einordnung der politischen Lage.',
    paragraphs: ['Ein sehr langer, informativer Absatz über das Thema mit wichtigen Hintergründen.'],
  };
  const dupRich = { ...makeArticle('dup', 'https://rich.de/2'), sourceId: 's2', summary: 'Duplikat' };

  const picks = selectFreeAlternatives(current, [sameSource, shortFree, richFree, dupRich], 3);
  assert.deepEqual(picks.map(item => item.id), ['rich', 'short']);
});

test('filterUnreadStories hides read leads only when unreadOnly is active', () => {
  const stories = [
    { lead: makeArticle('a1', 'https://a.de/1') },
    { lead: makeArticle('a2', 'https://a.de/2') },
    { lead: makeArticle('a3', 'https://a.de/3') },
  ];
  const readIds = new Set(['a1', 'a3']);
  assert.equal(filterUnreadStories(stories, readIds, false).length, 3);
  assert.deepEqual(filterUnreadStories(stories, readIds, true).map(s => s.lead.id), ['a2']);
});

test('exportHighlightsMarkdown formats quotes and notes cleanly', () => {
  const md = exportHighlightsMarkdown([
    {
      id: 'h1',
      articleId: 'a1',
      articleTitle: 'Bericht',
      articleLink: 'https://a.de/1',
      sourceName: 'ZEIT',
      quote: 'Ein wichtiger Satz.',
      note: 'Später prüfen',
      createdAt: '2026-11-20T10:00:00Z',
    },
  ]);
  assert.match(md, /> Ein wichtiger Satz\./);
  assert.match(md, /Notiz: Später prüfen/);
});
