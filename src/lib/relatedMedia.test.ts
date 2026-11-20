import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import { findPriorCoverage, findRelatedMediaForArticle } from './relatedMedia';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: overrides.id ?? 'id',
    sourceId: overrides.sourceId ?? 'src',
    sourceName: overrides.sourceName ?? 'Source',
    sourceShortCode: 'SR',
    sourceColor: '#111',
    title: overrides.title ?? 'Title',
    summary: overrides.summary ?? '',
    paragraphs: [],
    link: overrides.link ?? `https://example.org/${overrides.id ?? 'item'}`,
    category: overrides.category ?? 'Politik',
    publishedAt: overrides.publishedAt ?? '2026-11-20T10:00:00Z',
    readingTimeMin: 2,
    keywords: overrides.keywords ?? [],
    ...overrides,
  };
}

test('findRelatedMediaForArticle links an article to videos and podcasts covering the same topic', () => {
  const current = makeArticle({
    id: 'art-1',
    title: 'Klimakonferenz in Belém einigt sich auf Finanzierungsplan für Klimaschutz',
    summary: 'Delegierte beschließen neue Hilfen für den Ausbau erneuerbarer Energien.',
    category: 'Politik',
  });

  const mediaPool = [
    makeArticle({
      id: 'vid-1',
      title: 'Klimakonferenz Belém: Was der neue Finanzierungsplan bedeutet',
      youtubeId: 'abc12345678',
      link: 'https://www.youtube.com/shorts/abc12345678',
      category: 'Politik',
    }),
    makeArticle({
      id: 'pod-1',
      title: 'Podcast: Einordnung zum Klimaschutz und der Klimakonferenz',
      audioUrl: 'https://example.org/ep1.mp3',
      link: 'https://example.org/ep1',
      category: 'Politik',
    }),
    makeArticle({
      id: 'vid-unrelated',
      title: 'Champions League Highlights vom Mittwochabend',
      youtubeId: 'zzz99999999',
      link: 'https://www.youtube.com/watch?v=zzz99999999',
      category: 'Sport',
    }),
  ];

  const related = findRelatedMediaForArticle(current, mediaPool, 3);
  assert.equal(related.length, 2);
  assert.equal(related[0].article.id, 'vid-1');
  assert.equal(related[1].article.id, 'pod-1');
});

test('findPriorCoverage finds earlier related reports for local background context', () => {
  const current = makeArticle({
    id: 'now',
    title: 'Halbleiterfabrik in Dresden startet Testbetrieb',
    publishedAt: '2026-11-20T10:00:00Z',
  });
  const earlier = makeArticle({
    id: 'old',
    title: 'Förderbescheid für neue Halbleiterfabrik in Dresden übergeben',
    publishedAt: '2026-11-18T10:00:00Z',
  });
  const future = makeArticle({
    id: 'future',
    title: 'Halbleiterfabrik Dresden Ausblick',
    publishedAt: '2026-11-21T10:00:00Z',
  });
  const prior = findPriorCoverage(current, [current, earlier, future]);
  assert.deepEqual(prior.map(a => a.id), ['old']);
});
