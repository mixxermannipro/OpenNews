import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import { synthesizeLocalBriefing } from './dailyBriefingSynth';

function makeArticle(id: string, source: string, category: NewsArticle['category'], title: string, summary: string, isBreaking = false): NewsArticle {
  return {
    id,
    sourceId: source.toLowerCase(),
    sourceName: source,
    sourceShortCode: source.slice(0, 2).toUpperCase(),
    sourceColor: '#2563EB',
    title,
    summary,
    paragraphs: [summary],
    link: `https://example.org/${id}`,
    category,
    publishedAt: '2026-11-20T08:00:00Z',
    readingTimeMin: 2,
    keywords: [],
    isBreaking,
  };
}

test('synthesizeLocalBriefing builds structured thematic bullets, citations, quick notes, and spoken script', () => {
  const articles = [
    makeArticle('1', 'tagesschau', 'Politik', 'Europaparlament beschließt strenges Digitalgesetz für große Plattformen', 'Ab nächstem Jahr gelten europaweit strengere Transparenzregeln für große Plattformen.', true),
    makeArticle('2', 'SPIEGEL', 'Politik', 'Europaparlament beschließt strenges Digitalgesetz für große Plattformen in Brüssel', 'Die Minister stimmten am Morgen in Brüssel dem Kompromiss zu.'),
    makeArticle('3', 'heise', 'Technologie', 'Neue Akkutechnik verdoppelt Reichweite von E-Autos', 'Forscher in Stuttgart präsentieren eine marktreife Festkörperzelle mit 900 Kilometern Reichweite.'),
    makeArticle('4', 'Handelsblatt', 'Wirtschaft', 'DAX startet freundlich in die Handelswoche', 'Vor allem Halbleiterwerte und Industrieaktien legen zum Handelsauftakt deutlich zu.'),
    makeArticle('5', 'BBC', 'Wissenschaft', 'NASA launches new orbital climate observatory', 'The satellite will measure atmospheric methane levels across all continents daily.'),
  ];

  const morning = synthesizeLocalBriefing(articles, 'de', new Date('2026-11-20T08:30:00'), 3);
  assert.equal(morning.greeting, 'Guten Morgen');
  assert.equal(morning.bullets.length, 3);
  assert.equal(morning.bullets[0].sources.length, 2); // Clustered EU story leads!
  assert.ok(morning.bullets[0].detail.length > 20);
  assert.ok(morning.quickNotes.length >= 1);
  assert.ok(morning.estimatedMinutes >= 1);
  assert.match(morning.spokenScript, /Guten Morgen/);

  const eveningEn = synthesizeLocalBriefing(articles, 'en', new Date('2026-11-20T20:15:00'), 3);
  assert.equal(eveningEn.greeting, 'Good evening');
});
