import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import {
  buildSpeechBlocks,
  estimateQueueMinutes,
  exportHighlightsMarkdown,
  selectArticlesToPreload,
  shouldPreloadOffline,
  upsertAudioPosition,
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

test('selectArticlesToPreload prioritizes saved items and skips cached or feed-only entries', () => {
  const saved = [makeArticle('s1', 'https://a.de/saved-1')];
  const today = [
    makeArticle('t1', 'https://a.de/cached'),
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
