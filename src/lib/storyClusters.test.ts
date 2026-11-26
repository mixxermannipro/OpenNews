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

test('clusters cross-category German stories with compound nouns and thousand-dot numbers', () => {
  const t0 = '2026-11-25T10:00:00Z';
  const t1 = '2026-11-25T11:30:00Z';
  const reports = [
    { id: 'masern-zeit', title: 'US-Gesundheitsbehörde meldet mehr als 6.000 Masernfälle', category: 'Gesellschaft', sourceId: 'zeit', publishedAt: t0 },
    { id: 'masern-dlf', title: 'USA: Mehr als 6.000 Maserninfektionen in diesem Jahr', category: 'Politik', sourceId: 'dlf', publishedAt: t1 },
    { id: 'rente-ts', title: 'Streit über Rente mit 63 und Respekt-Rente', category: 'Politik', sourceId: 'tagesschau', publishedAt: t0 },
    { id: 'rente-ntv', title: 'Debatte um Rente mit 63: SPD pocht auf Respekt-Rente', category: 'Politik', sourceId: 'ntv', publishedAt: t1 },
    { id: 'dart-sp', title: 'NASA-Sonde Dart hinterließ riesigen Krater auf Asteroid Dimorphos', category: 'Wissenschaft', sourceId: 'spiegel', publishedAt: t0 },
    { id: 'dart-heise', title: 'Asteroid Dimorphos: Neue Bilder zeigen Einschlagkrater der Dart-Mission', category: 'Technologie', sourceId: 'heise', publishedAt: t1 },
    { id: 'unrelated', title: 'Deutsche Bahn startet neuen Winterfahrplan im Fernverkehr', category: 'Wirtschaft', sourceId: 'faz', publishedAt: t1 },
  ] as NewsArticle[];

  const groups = clusterStories(reports);
  assert.deepEqual(
    groups.map(group => group.reports.map(r => r.id)),
    [
      ['masern-zeit', 'masern-dlf'],
      ['rente-ts', 'rente-ntv'],
      ['dart-sp', 'dart-heise'],
      ['unrelated'],
    ],
  );
});

test('clusters German compound-word business headlines covering the same tariff agreement', () => {
  const reports = [
    {
      id: 'dlf-metall',
      title: 'Tarifabschluss - IG Metall und Arbeitgeber erzielen Einigung: 4,3 Prozent mehr Geld',
      category: 'Wirtschaft',
      sourceId: 'deutschlandfunk',
      publishedAt: '2026-11-26T16:40:00Z',
    },
    {
      id: 'hb-metall',
      title: 'Tarifkonflikt beigelegt: Neuer Metalltarif lässt Ausnahmen von 35-Stunden-Woche zu',
      category: 'Wirtschaft',
      sourceId: 'handelsblatt',
      publishedAt: '2026-11-26T16:50:00Z',
    },
    {
      id: 'ezb-other',
      title: 'Spanier Hernandez de Cos soll Lagarde bei der EZB nachfolgen',
      category: 'Wirtschaft',
      sourceId: 'zeit',
      publishedAt: '2026-11-26T16:55:00Z',
    },
  ] as NewsArticle[];

  const groups = clusterStories(reports);
  assert.deepEqual(
    groups.map(group => group.reports.map(r => r.id)),
    [
      ['dlf-metall', 'hb-metall'],
      ['ezb-other'],
    ],
  );
});

test('clusters cross-category German compound-noun reports on the same event within 12 hours', () => {
  const reports = [
    {
      id: 'zeit-metall',
      title: 'Metall- und Elektroindustrie: Gewerkschaft und Arbeitgeber erzielen Einigung in Metall-Tarifrunde',
      category: 'Wirtschaft',
      sourceId: 'zeit',
      publishedAt: '2026-11-26T16:45:00Z',
    },
    {
      id: 'dlf-metall-pol',
      title: 'Tarifverhandlungen - Neuer Metalltarif lässt Ausnahmen von 35-Stunden-Woche zu - Steigerungen von insgesamt 4,3 Prozent',
      category: 'Politik',
      sourceId: 'deutschlandfunk',
      publishedAt: '2026-11-26T17:10:00Z',
    },
    {
      id: 'pol-other',
      title: 'Verfassungsschutz beobachtet weitere Landesverbände nach Gerichtsbeschluss',
      category: 'Politik',
      sourceId: 'tagesschau',
      publishedAt: '2026-11-26T17:15:00Z',
    },
  ] as NewsArticle[];

  const groups = clusterStories(reports);
  assert.deepEqual(
    groups.map(group => group.reports.map(r => r.id)),
    [
      ['zeit-metall', 'dlf-metall-pol'],
      ['pol-other'],
    ],
  );
});
