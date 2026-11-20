import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../types/news';
import { buildTrendingTopics, classifyArticleType, detectAndClarifyClickbait } from './localEditorialAI';

function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: overrides.id ?? 'a1',
    sourceId: overrides.sourceId ?? 'tagesschau',
    sourceName: overrides.sourceName ?? 'tagesschau',
    sourceShortCode: overrides.sourceShortCode ?? 'TS',
    sourceColor: overrides.sourceColor ?? '#0284C7',
    title: overrides.title ?? 'EU einigt sich auf neue Klimaziele bis 2040',
    summary: overrides.summary ?? 'Die Mitgliedstaaten beschließen strengere CO2-Vorgaben für Energie und Verkehr.',
    paragraphs: overrides.paragraphs ?? [],
    link: overrides.link ?? 'https://example.org/a1',
    category: overrides.category ?? 'Politik',
    publishedAt: overrides.publishedAt ?? '2026-11-20T09:00:00Z',
    readingTimeMin: 3,
    keywords: overrides.keywords ?? ['eu', 'klima'],
    ...overrides,
  };
}

test('classifyArticleType distinguishes breaking, opinion, interview, analysis, factcheck, and report', () => {
  assert.equal(classifyArticleType(article({ isBreaking: true })), 'breaking');
  assert.equal(classifyArticleType(article({ title: 'Kommentar: Warum die Reform zu spät kommt' })), 'opinion');
  assert.equal(classifyArticleType(article({ title: 'Opinion: The quiet shift in European trade' })), 'opinion');
  assert.equal(classifyArticleType(article({ title: 'Im Gespräch mit dem Bundesbank-Präsidenten' })), 'interview');
  assert.equal(classifyArticleType(article({ title: 'Faktencheck: Stimmt die Behauptung zur Stromlücke?' })), 'factcheck');
  assert.equal(classifyArticleType(article({ title: 'Analyse: Wie die EZB auf die Inflation reagiert' })), 'analysis');
  assert.equal(classifyArticleType(article({ title: 'Bundestag beschließt Haushalt für das kommende Jahr' })), 'report');
});

test('detectAndClarifyClickbait identifies sensational titles and extracts a calm lead sentence', () => {
  const sensational = article({
    title: 'Du wirst nicht glauben, was danach im Bundestag passierte!!',
    summary: 'Der Ausschuss hat mit knapper Mehrheit einen neuen Entwurf für das Rentenpaket vertagt. Die Abstimmung soll im Dezember nachgeholt werden.',
  });
  const res = detectAndClarifyClickbait(sensational);
  assert.equal(res.isClickbait, true);
  assert.match(res.clarifiedLead ?? '', /Rentenpaket vertagt/);

  const normal = article({ title: 'EZB belässt Leitzins unverändert bei 2,5 Prozent' });
  assert.equal(detectAndClarifyClickbait(normal).isClickbait, false);
});

test('buildTrendingTopics surfaces multi-source stories ranked by distinct source coverage', () => {
  const items = [
    article({ id: '1', sourceId: 'ts', sourceName: 'tagesschau', title: 'Bundestag beschließt neues Klimapaket für Gebäude und Heizungen' }),
    article({ id: '2', sourceId: 'sp', sourceName: 'SPIEGEL', title: 'Bundestag beschließt neues Klimapaket für Gebäude und Heizungen heute' }),
    article({ id: '3', sourceId: 'sz', sourceName: 'SZ', title: 'Klimapaket für Gebäude und Heizungen: Bundestag beschließt Reform' }),
    article({ id: '4', sourceId: 'heise', sourceName: 'heise', title: 'Neuer Linux-Kernel bringt bessere Akkulaufzeit' }),
  ];
  const trending = buildTrendingTopics(items, 4);
  assert.equal(trending.length, 1);
  assert.equal(trending[0].sourceCount, 3);
  assert.equal(trending[0].sources.length, 3);
});
