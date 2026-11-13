import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultProfile,
  generateLocalExtractiveSummary,
  rankArticlesForYou,
  recordReadingDuration,
  toggleArticleBookmark,
  toggleArticleDislike,
  toggleArticleLike,
} from './personalization';
import { DEFAULT_SOURCES } from './catalog';
import type { NewsArticle } from '../types/news';

const nowMs = Date.parse('2026-11-12T12:00:00Z');

const sampleArticles: NewsArticle[] = [
  {
    id: 'a-pol',
    sourceId: 'tagesschau',
    sourceName: 'Tagesschau',
    sourceShortCode: 'TS',
    sourceColor: '#3B82F6',
    title: 'Bundestag debattiert Haushalt',
    summary: 'Debatte über Investitionen im Bundestag.',
    paragraphs: ['Die Abgeordneten beraten heute über den neuen Etat und Investitionen in Infrastruktur.'],
    link: 'https://example.com/pol',
    category: 'Politik',
    publishedAt: '2026-11-12T11:30:00Z',
    readingTimeMin: 3,
    keywords: ['bundestag', 'haushalt', 'investitionen'],
  },
  {
    id: 'a-tech',
    sourceId: 'heise',
    sourceName: 'heise online',
    sourceShortCode: 'HO',
    sourceColor: '#38BDF8',
    title: 'Neue offene KI-Chips für Smartphones',
    summary: 'Lokale Sprachmodelle laufen jetzt direkt auf Android-Geräten.',
    paragraphs: [
      'Moderne Mobilprozessoren bieten dedizierte Einheiten für lokale KI-Berechnungen.',
      'Dadurch bleiben persönliche Daten vollständig auf dem Smartphone.',
    ],
    link: 'https://example.com/tech',
    category: 'Technologie',
    publishedAt: '2026-11-12T08:00:00Z',
    readingTimeMin: 4,
    keywords: ['chips', 'smartphones', 'lokale', 'datenschutz'],
  },
];

test('liking a Technologie article elevates Technologie articles in Für dich ranking', () => {
  let profile = createDefaultProfile();
  // Initially Politik article is fresher, so it ranks higher
  const initialRank = rankArticlesForYou(sampleArticles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(initialRank[0].article.id, 'a-pol');

  // User likes the older Technologie article
  profile = toggleArticleLike(profile, sampleArticles[1]);
  assert.ok(profile.likedIds.includes('a-tech'));
  assert.ok((profile.topicWeights['Technologie'] ?? 0) > 0);
  assert.ok((profile.sourceWeights['heise'] ?? 0) > 0);

  // Now the Technologie article outranks the fresher Politik article in personalized order
  const updatedRank = rankArticlesForYou(sampleArticles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(updatedRank[0].article.id, 'a-tech');
  assert.ok(updatedRank[0].reason?.includes('Technologie'));
});

test('disliking an article filters it out of personalized feed', () => {
  let profile = createDefaultProfile();
  profile = toggleArticleDislike(profile, sampleArticles[0]);
  const ranked = rankArticlesForYou(sampleArticles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(ranked.some((r) => r.article.id === 'a-pol'), false);
});

test('bookmarking and local extractive summary work deterministically', () => {
  let profile = createDefaultProfile();
  profile = toggleArticleBookmark(profile, sampleArticles[1]);
  assert.equal(profile.bookmarkedIds.includes('a-tech'), true);

  const summary = generateLocalExtractiveSummary(sampleArticles[1]);
  assert.equal(summary.mode, 'local');
  assert.ok(summary.bullets.length >= 2);
});

test('reading time duration increases topic and source affinity for Für dich recommendations', () => {
  let profile = createDefaultProfile();
  profile = recordReadingDuration(profile, sampleArticles[1], 90);
  assert.equal(profile.totalReadingSeconds, 90);
  assert.equal(profile.readingSecondsByTopic['Technologie'], 90);
  assert.equal(profile.readingSecondsBySource['heise'], 90);

  const ranked = rankArticlesForYou(sampleArticles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(ranked[0].article.id, 'a-tech');
  assert.ok(ranked[0].reason?.includes('Technologie'));
});

test('switching reactions replaces their contribution to the profile', () => {
  const article = sampleArticles[1];
  const empty = createDefaultProfile();
  const liked = toggleArticleLike(empty, article);
  const disliked = toggleArticleDislike(liked, article);
  assert.deepEqual(disliked, toggleArticleDislike(empty, article));
  assert.deepEqual(toggleArticleLike(disliked, article), liked);
  assert.deepEqual(toggleArticleDislike(disliked, article), empty);
});

test('Für dich mixes similarly scored providers in the first recommendations', () => {
  const articles = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...sampleArticles[0], id: `politics-${i}` })),
    { ...sampleArticles[1], publishedAt: sampleArticles[0].publishedAt },
  ];
  const ranked = rankArticlesForYou(articles, createDefaultProfile(), DEFAULT_SOURCES, nowMs);
  assert.equal(new Set(ranked.slice(0, 2).map(entry => entry.article.sourceId)).size, 2);
  assert.equal(new Set(ranked.map(entry => entry.article.id)).size, articles.length);
});
