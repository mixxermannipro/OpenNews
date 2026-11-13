import test from 'node:test';
import { buildHomeSections, DAY_MS, mergeFeedArticles, pruneFeedArticles } from './newsFeed';
import { resolveRetention } from './preferences';
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

test('reading time records affinity without lifting a much older story', () => {
  let profile = createDefaultProfile();
  profile = recordReadingDuration(profile, sampleArticles[1], 90);
  assert.equal(profile.totalReadingSeconds, 90);
  assert.equal(profile.readingSecondsByTopic['Technologie'], 90);
  assert.equal(profile.readingSecondsBySource['heise'], 90);

  const ranked = rankArticlesForYou(sampleArticles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(ranked[0].article.id, 'a-pol');
  assert.ok(profile.topicWeights.Technologie > 0);
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

test('a long reading session has less influence than a like', () => {
  const article = sampleArticles[1];
  const empty = createDefaultProfile();
  const reading = recordReadingDuration(empty, article, 600);
  const liked = toggleArticleLike(empty, article);
  assert.ok((reading.topicWeights[article.category] ?? 0) < liked.topicWeights[article.category] / 4);
});

test('legacy reading activity cannot crowd other recent topics out of the feed', () => {
  const profile = {
    ...createDefaultProfile(),
    topicWeights: { Politik: 30 },
    sourceWeights: { tagesschau: 30 },
    keywordWeights: { bundestag: 30, haushalt: 30 },
    readingSecondsByTopic: { Politik: 6000 },
    readingSecondsBySource: { tagesschau: 6000 },
  };
  const articles = [
    ...Array.from({ length: 70 }, (_, i) => ({ ...sampleArticles[0], id: `politics-${i}` })),
    ...sampleArticles.slice(1),
    { ...sampleArticles[1], id: 'science', category: 'Wissenschaft' as const, sourceId: 'dw' },
  ];
  const ranked = rankArticlesForYou(articles, profile, DEFAULT_SOURCES, nowMs);
  assert.equal(new Set(ranked.slice(0, 6).map(({ article }) => article.category)).size, 3);
  assert.equal(ranked.length, articles.length);
});

test('a fresh breaking story leads even with a strong interest in another topic', () => {
  const article = sampleArticles[1];
  const profile = toggleArticleLike(createDefaultProfile(), article);
  const breaking = { ...sampleArticles[0], publishedAt: article.publishedAt, isBreaking: true };
  assert.equal(rankArticlesForYou([article, breaking], profile, DEFAULT_SOURCES, nowMs)[0].article.id, breaking.id);
});

test('Heute favors important stories and mixes sources independently of personal dislikes', () => {
  const localNoon = new Date(2026, 10, 12, 12).getTime();
  const politics = { ...sampleArticles[0], publishedAt: new Date(localNoon - 30 * 60_000).toISOString() };
  const technology = { ...sampleArticles[1], publishedAt: new Date(localNoon - 4 * 60 * 60_000).toISOString() };
  const breaking = { ...politics, id: 'breaking', link: 'https://example.com/breaking', isBreaking: true, publishedAt: technology.publishedAt };
  const profile = { ...createDefaultProfile(), dislikedIds: ['breaking'] };
  const sections = buildHomeSections([politics, breaking, technology], profile, DEFAULT_SOURCES, localNoon);
  assert.deepEqual(sections.Heute.map(article => article.id), ['breaking', 'a-tech', 'a-pol']);
  assert.deepEqual(sections.Neueste.map(article => article.id), ['a-pol', 'a-tech', 'breaking']);
  assert.ok(!sections['Für dich'].some(article => article.id === 'breaking'));
});

test('older stories stay available in Neueste without filling Heute or Für dich', () => {
  const older = { ...sampleArticles[0], publishedAt: new Date(nowMs - 3 * DAY_MS).toISOString() };
  const sections = buildHomeSections([older], createDefaultProfile(), DEFAULT_SOURCES, nowMs);
  assert.deepEqual(sections, { Heute: [], 'Für dich': [], Neueste: [older] });
});

test('feed retention expires at the chosen cutoff and falls back to four days', () => {
  const expired = { ...sampleArticles[0], publishedAt: new Date(nowMs - 4 * DAY_MS).toISOString() };
  const fresh = { ...sampleArticles[1], publishedAt: new Date(nowMs - 4 * DAY_MS + 1).toISOString() };
  assert.equal(resolveRetention(undefined), '4');
  assert.equal(resolveRetention('invalid'), '4');
  assert.deepEqual(pruneFeedArticles([expired, fresh], '4', nowMs), [fresh]);
  assert.deepEqual(pruneFeedArticles([expired, fresh], '7', nowMs), [expired, fresh]);
});

test('feed refresh retains articles missing from the latest RSS response', () => {
  const [older, latest] = sampleArticles;
  const previous = { ...older, id: 'previous', link: 'https://example.com/previous', publishedAt: latest.publishedAt };
  const updated = { ...older, title: 'Aktualisierte Überschrift' };
  assert.deepEqual(mergeFeedArticles([older, previous], [updated], '4', nowMs), [updated, previous]);
});

test('Heute gives different stories room before near-identical headlines', () => {
  const now = new Date(2026, 10, 12, 12).getTime();
  const publishedAt = new Date(now - 60_000).toISOString();
  const first = { ...sampleArticles[0], id: 'one', title: 'Microsoft meldet Fortschritte nach weltweiten IT-Ausfällen', publishedAt, isBreaking: true };
  const repeated = { ...first, id: 'two', link: 'https://example.net/report', sourceId: 'another', title: 'IT-Ausfällen weltweit: Microsoft meldet deutliche Fortschritte' };
  const different = { ...sampleArticles[1], id: 'three', title: 'Forschende entdecken neuen Exoplaneten', publishedAt };

  const sections = buildHomeSections([first, repeated, different], createDefaultProfile(), DEFAULT_SOURCES, now);
  assert.deepEqual(sections.Heute.map(article => article.id), ['one', 'three', 'two']);
  assert.deepEqual(sections['Für dich'].map(article => article.id), ['one', 'three', 'two']);
});

test('dedicated podcast sources stay available to media without filling text feeds', () => {
  const now = new Date(2026, 10, 12, 12).getTime();
  const source = DEFAULT_SOURCES.find(source => source.format === 'podcast')!;
  const episode = { ...sampleArticles[0], sourceId: source.id, publishedAt: new Date(now - 60_000).toISOString() };
  const sections = buildHomeSections([episode], createDefaultProfile(), DEFAULT_SOURCES, now);
  assert.deepEqual(sections, { Heute: [], 'Für dich': [], Neueste: [] });
});

test('Heute can lead with an important public story ahead of a newer leisure item', () => {
  const now = new Date(2026, 10, 12, 12).getTime();
  const publicStory = { ...sampleArticles[0], category: 'Politik' as const, publishedAt: new Date(now - 3_600_000).toISOString() };
  const leisure = { ...sampleArticles[1], category: 'Kultur' as const, publishedAt: new Date(now - 60_000).toISOString() };
  assert.deepEqual(buildHomeSections([publicStory, leisure], createDefaultProfile(), DEFAULT_SOURCES, now).Heute.map(a => a.id), ['a-pol', 'a-tech']);
});
