import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsArticle } from '../types/news';
import { distinctArticles, mergeFeedArticles } from './newsFeed';

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
