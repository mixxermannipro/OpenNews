import assert from 'node:assert/strict';
import test from 'node:test';
import { clusterStories } from './storyClusters';
import type { NewsArticle } from '../types/news';

test('groups similar recent reports while retaining distinct events', () => {
  const article = (id: string, title: string, publishedAt = '2026-11-14T09:00:00Z') => ({
    id, title, publishedAt, category: 'Politik', sourceId: id,
  }) as NewsArticle;
  const reports = [
    article('one', 'Bundestag beschließt Haushalt für Verkehr und Schulen'),
    article('two', 'Bundestag beschließt Haushalt für Schulen und Verkehr'),
    article('old', 'Bundestag beschließt Haushalt für Schulen und Verkehr', '2026-11-01T09:00:00Z'),
    article('other', 'Bundestag diskutiert Änderungen am Rentenpaket'),
  ];
  const groups = clusterStories(reports);
  assert.deepEqual(groups.map(group => group.reports.map(report => report.id)), [['one', 'two'], ['old'], ['other']]);
});

test('groups identical short headlines across topics within the time window', () => {
  const first = { id: 'a', title: 'Bahn streikt!', category: 'Wirtschaft', publishedAt: '2026-11-14T10:00:00Z' } as NewsArticle;
  const second = { ...first, id: 'b', title: 'BAHN STREIKT', category: 'Gesellschaft' as const };
  const different = { ...first, id: 'c', title: 'Bahn droht Streik' };
  assert.deepEqual(clusterStories([first, second, different]).map(story => story.reports.map(report => report.id)), [['a', 'b'], ['c']]);
});

test('handles large article sets with indexed lookup and merges matching reports into earliest cluster', () => {
  const base = Date.parse('2026-11-14T12:00:00Z');
  const filler = Array.from({ length: 300 }, (_, i) => ({
    id: `filler-${i}`,
    title: `Thema${i}alpha Bereich${i}beta Projekt${i}gamma Region${i}delta`,
    category: 'Politik' as const,
    sourceId: `src-${i % 10}`,
    publishedAt: new Date(base - i * 60_000).toISOString(),
  }) as NewsArticle);
  const lead = {
    id: 'lead-story',
    title: 'Europäische Zentralbank senkt Leitzins deutlich im November',
    category: 'Wirtschaft' as const,
    sourceId: 'src-a',
    publishedAt: new Date(base - 10_000).toISOString(),
  } as NewsArticle;
  const followUp = {
    id: 'followup-story',
    title: 'Leitzins im November: Europäische Zentralbank senkt deutlich',
    category: 'Wirtschaft' as const,
    sourceId: 'src-b',
    publishedAt: new Date(base - 5_000).toISOString(),
  } as NewsArticle;

  const groups = clusterStories([lead, ...filler, followUp]);
  const ecbCluster = groups.find(g => g.lead.id === 'lead-story');
  assert.ok(ecbCluster);
  assert.deepEqual(ecbCluster.reports.map(r => r.id), ['lead-story', 'followup-story']);
  assert.equal(groups.length, 301);
});
