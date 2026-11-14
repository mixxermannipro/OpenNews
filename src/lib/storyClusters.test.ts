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
