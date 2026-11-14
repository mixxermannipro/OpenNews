import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsArticle } from '../types/news';
import { buildHomeSections, DAY_MS, distinctArticles, mergeFeedArticles } from './newsFeed';
import { featuredStoryIds } from './featuredStories';
import { createDefaultProfile } from './personalization';

const article: NewsArticle = {
  id: 'a', sourceId: 'first', sourceName: 'First', sourceShortCode: 'F', sourceColor: '#000',
  title: 'Ein wichtiger Bericht', summary: '', paragraphs: [],
  link: 'https://example.org/news/story?edition=de',
  category: 'Politik', publishedAt: '2026-11-13T08:00:00Z', readingTimeMin: 2, keywords: [],
};

test('deduplicates syndication and tracking links but keeps distinct editions', () => {
  const duplicate = {
    ...article, id: 'b', sourceId: 'second',
    link: 'http://www.example.org/news/story/?utm_source=rss&edition=de#top',
  };
  const edition = { ...article, id: 'c', link: 'https://example.org/news/story?edition=en' };
  assert.deepEqual(distinctArticles([article, duplicate, edition]), [article, edition]);
});

test('keeps independent reporting and items linking only to the publisher homepage', () => {
  const another = { ...article, id: 'b', link: 'https://example.net/report' };
  const homepage = { ...article, id: 'c', link: 'https://example.org/' };
  const different = { ...homepage, id: 'd', title: 'Anderer Artikel' };
  assert.deepEqual(distinctArticles([article, another, homepage, different]), [article, another, homepage, different]);
});

test('updates a feed entry using its link and retains its previous ID', () => {
  const duplicate = { ...article, id: 'changed', title: 'Neue Überschrift', link: article.link + '&utm_source=new' };
  assert.deepEqual(mergeFeedArticles([article], [duplicate], '4', Date.parse(article.publishedAt)), [
    { ...duplicate, id: article.id },
  ]);
});

test('keeps entries separate if the feed URL is their only opening target', () => {
  const first = { ...article, linkIsFeed: true };
  const second = { ...first, id: 'b' };
  assert.deepEqual(distinctArticles([first, second]), [first, second]);
});

test('balances sources and topics before filling the agenda with one provider', () => {
  const now = new Date(2026, 10, 14, 12).getTime();
  const crowded = Array.from({ length: 5 }, (_, index) => ({
    ...article, id: 'crowded-' + index, title: 'Meldung ' + index, link: 'https://example.org/crowded/' + index,
    publishedAt: new Date(now - 60_000 * (index + 1)).toISOString(), isBreaking: true,
  }));
  const alternatives = (['Kultur', 'Wissenschaft', 'Technologie'] as const).map((category, index) => ({
    ...article, category, id: 'different-' + index, sourceId: 'source-' + index,
    title: category, link: 'https://example.net/' + index, publishedAt: new Date(now - 3_600_000).toISOString(),
  }));
  const sections = buildHomeSections([...crowded, ...alternatives], createDefaultProfile(), [], now);
  for (const key of ['Heute', 'Für dich'] as const) {
    const top = sections[key].slice(0, 5).map(story => story.lead);
    assert.equal(new Set(top.map(item => item.sourceId)).size, 4);
    assert.equal(new Set(top.map(item => item.category)).size, 4);
    assert.equal(top.filter(item => item.sourceId === article.sourceId).length, 2);
    assert.equal(sections[key].length, 8);
  }
});

test('keeps the newest version of a story on Neueste and omits unusable timestamps', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const recent = { ...article, title: 'Bundestag stimmt Reform Klimaschutz Gesetz zu', publishedAt: new Date(now - 1000).toISOString() };
  const related = { ...recent, id: 'b', link: 'https://another.example.org/detail', publishedAt: new Date(now - 2000).toISOString() };
  const older = { ...article, id: 'c', link: 'https://example.org/news/older', publishedAt: new Date(now - 3 * DAY_MS).toISOString() };
  const future = { ...article, id: 'd', publishedAt: new Date(now + 1000).toISOString() };
  const invalid = { ...article, id: 'e', publishedAt: 'invalid' };
  const sections = buildHomeSections([future, invalid, older, related, recent], createDefaultProfile(), [], now);
  assert.deepEqual(sections.Neueste.map(story => story.lead.id), ['a', 'c']);
  assert.deepEqual(sections.Neueste[0].reports, [recent, related]);
  assert.equal(sections['Für dich'].length, 1);
});

test('uses larger cards sparingly and only when a story merits emphasis', () => {
  const stories = Array.from({ length: 15 }, (_, index) => {
    const lead = { ...article, id: String(index), isBreaking: [1, 7, 8].includes(index) };
    const reports = index === 12 ? [lead, { ...lead, sourceId: 'another-source' }] : [lead];
    return { lead, reports };
  });
  assert.deepEqual([...featuredStoryIds(stories, { featureLead: true })], ['0', '7', '12']);
  assert.deepEqual([...featuredStoryIds(stories, { ranked: false })], ['1', '7', '12']);
  const ordinary = stories.slice(2, 6);
  ordinary[0].lead.imageUrl = 'https://example.org/photo.jpg';
  assert.deepEqual([...featuredStoryIds(ordinary)], ['2']);
  assert.equal(featuredStoryIds(ordinary, { ranked: false }).size, 0);
});

test('makes room in the first four recommendations for reporting beyond strong interests', () => {
  const now = new Date(2026, 10, 14, 18).getTime();
  const personal = Array.from({ length: 8 }, (_, index) => ({
    ...article, id: 'sports-' + index, sourceId: 'sports-source-' + index,
    title: 'Spielbericht ' + index, category: 'Sport' as const, keywords: ['Fußball', 'Liga', 'Pokal'],
    link: 'https://example.org/sports/' + index, publishedAt: new Date(now - 60_000).toISOString(),
  }));
  const publicStory = {
    ...article, id: 'public-agenda', publishedAt: new Date(now - 21 * 3_600_000).toISOString(),
  };
  const profile = { ...createDefaultProfile(), topicWeights: { Sport: 3 }, keywordWeights: { Fußball: 3, Liga: 3, Pokal: 3 } };
  const top = buildHomeSections([...personal, publicStory], profile, [], now)['Für dich'].slice(0, 4);
  assert.equal(top[3].lead.id, publicStory.id);
  assert.equal(top[3].reason, 'Wichtiges Thema außerhalb deiner Interessen');
});

test('uses corroboration and handles obvious teasers without changing chronology', () => {
  const now = new Date(2026, 10, 14, 18).getTime();
  const teaser = {
    ...article, id: 'teaser', title: 'Das glaubst du nie: unglaubliche neue Nachrichten',
    publishedAt: new Date(now - 60_000).toISOString(),
  };
  const report = {
    ...article, id: 'report', title: 'Bundestag beschließt Haushalt für Verkehr und Schulen',
    link: 'https://reporter.example.net/details', publishedAt: new Date(now - 70 * 60_000).toISOString(),
  };
  const secondReport = {
    ...report, id: 'confirmation', sourceId: 'another', title: 'Bundestag beschließt Haushalt für Schulen und Verkehr',
    link: 'https://another.example.com/details', publishedAt: new Date(now - 90 * 60_000).toISOString(),
  };
  const sections = buildHomeSections([teaser, report, secondReport], createDefaultProfile(), [], now);
  assert.deepEqual(sections.Heute.map(story => story.lead.id), ['report', 'teaser']);
  assert.equal(sections.Heute[0].reason, 'Von mehreren Quellen berichtet');
  assert.deepEqual(sections.Neueste.map(story => story.lead.id), ['teaser', 'report']);
});

test('reduces the influence of learned interests before the 48-hour cutoff', () => {
  const now = new Date(2026, 10, 14, 18).getTime();
  const fresh = { ...article, id: 'fresh', publishedAt: new Date(now - 12 * 3_600_000).toISOString() };
  const old = {
    ...article, id: 'old', title: 'Ein alter Spielbericht', link: 'https://example.net/old',
    category: 'Sport' as const, sourceId: 'favorite', keywords: ['Fußball', 'Liga', 'Pokal'],
    publishedAt: new Date(now - 29 * 3_600_000).toISOString(),
  };
  const profile = {
    ...createDefaultProfile(), topicWeights: { Sport: 3 }, sourceWeights: { favorite: 3 },
    keywordWeights: { Fußball: 3, Liga: 3, Pokal: 3 },
  };
  assert.equal(buildHomeSections([fresh, old], profile, [], now)['Für dich'][0].lead.id, 'fresh');
});
