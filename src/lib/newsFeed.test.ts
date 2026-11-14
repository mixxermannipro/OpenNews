import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsArticle } from '../types/news';
import { buildHomeSections, DAY_MS, distinctArticles, mergeFeedArticles } from './newsFeed';
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
