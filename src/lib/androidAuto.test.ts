import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SOURCES } from './catalog.ts';
import { buildAndroidAutoPayload, DEFAULT_ANDROID_AUTO_SETTINGS } from './androidAuto.ts';
import type { NewsArticle } from '../types/news.ts';

test('buildAndroidAutoPayload filters audio podcast feeds and excludes YouTube/video feeds', () => {
  const payload = buildAndroidAutoPayload({
    settings: DEFAULT_ANDROID_AUTO_SETTINGS,
    language: 'de',
    sources: DEFAULT_SOURCES,
    articles: [],
    radioFavorites: ['dlf', 'br24'],
    audioPositions: {},
  });

  assert.ok(payload.feeds.some((f) => f.id === 'tagesschau-20-audio' && f.newsUpdate));
  assert.ok(payload.feeds.some((f) => f.id === 'tagesschau-100s-audio' && f.newsUpdate));
  assert.ok(payload.feeds.some((f) => f.id === 'zdf-heute-journal-podcast' && f.newsUpdate));
  assert.ok(!payload.feeds.some((f) => f.id === 'tagesschau-youtube'));
  assert.ok(!payload.feeds.some((f) => f.id === 'tagesschau-20-video'));
  assert.deepEqual(payload.radioFavorites, ['dlf', 'br24']);
});

test('buildAndroidAutoPayload populates queue with HTTPS audio episodes and deduplicates URLs', () => {
  const articles: NewsArticle[] = [
    {
      id: 'ts-yesterday',
      sourceId: 'tagesschau-20-audio',
      sourceName: 'Tagesschau 20 Uhr (Audio)',
      sourceShortCode: 'ARD',
      sourceColor: '#2563EB',
      title: 'tagesschau 20:00 Uhr, Vortag',
      summary: 'Abendausgabe zum Nachhören',
      paragraphs: [],
      link: 'https://www.tagesschau.de/',
      category: 'Politik',
      publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
      readingTimeMin: 1,
      keywords: ['tagesschau'],
      audioUrl: 'https://tagesschau-podcast.ard-mcdn.de/audio/2026/ts2000.mp3',
      durationSec: 900,
    },
    {
      id: 'ts-dup',
      sourceId: 'tagesschau-20-audio',
      sourceName: 'Tagesschau 20 Uhr (Audio)',
      sourceShortCode: 'ARD',
      sourceColor: '#2563EB',
      title: 'Duplikat',
      summary: '',
      paragraphs: [],
      link: 'https://www.tagesschau.de/',
      category: 'Politik',
      publishedAt: new Date(Date.now() - 90_000_000).toISOString(),
      readingTimeMin: 1,
      keywords: [],
      audioUrl: 'https://tagesschau-podcast.ard-mcdn.de/audio/2026/ts2000.mp3',
    },
  ];

  const payload = buildAndroidAutoPayload({
    settings: DEFAULT_ANDROID_AUTO_SETTINGS,
    language: 'de',
    sources: DEFAULT_SOURCES,
    articles,
    radioFavorites: [],
    audioPositions: {
      'https://tagesschau-podcast.ard-mcdn.de/audio/2026/ts2000.mp3': {
        url: 'https://tagesschau-podcast.ard-mcdn.de/audio/2026/ts2000.mp3',
        seconds: 120,
        duration: 900,
        updatedAt: Date.now(),
      },
    },
  });

  assert.equal(payload.queue.length, 1);
  assert.equal(payload.queue[0]?.title, 'tagesschau 20:00 Uhr, Vortag');
  assert.equal(payload.queue[0]?.durationSec, 900);
  assert.equal(payload.queue[0]?.newsUpdate, true);
});
