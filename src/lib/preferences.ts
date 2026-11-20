import { clipSourceIds } from './catalog';
import type { LanguageSetting } from './i18n';
import type { NewsCategory, NewsSource } from '../types/news';

export const TOPICS = [
  'Politik', 'Wirtschaft', 'Technologie', 'Wissenschaft', 'Europa', 'Gesellschaft', 'Kultur', 'Sport',
] as const satisfies readonly NewsCategory[];

export const HOME_TABS = ['Heute', 'Für dich', 'Neueste'] as const;
export const HOME_TAB_LABELS = { Heute: 'Heute', 'Für dich': 'Für dich', Neueste: 'Neueste' } as const;
export type HomeTab = typeof HOME_TABS[number];

export function resolveHomeTab(value: unknown): HomeTab {
  if (value === 'Für dich') return 'Für dich';
  if (value === 'Neueste' || value === 'Alle') return 'Neueste';
  return 'Heute';
}

export const RETENTION_OPTIONS = {
  '2': '2 Tage',
  '4': '4 Tage (Standard)',
  '7': '7 Tage',
  '14': '2 Wochen',
  '30': '1 Monat (30 Tage)',
  '90': '3 Monate (90 Tage)',
} as const;
export type Retention = keyof typeof RETENTION_OPTIONS;

export function resolveRetention(value: unknown): Retention {
  return typeof value === 'string' && Object.hasOwn(RETENTION_OPTIONS, value)
    ? value as Retention
    : DEFAULT_PREFERENCES.retention;
}

export const EDITIONS = {
  balanced: {
    label: 'Ausgewogen',
    sources: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'faz', 'spiegel', 'zeit', 'handelsblatt', 'heise', 'guardian', 'nasa', 'dw'],
    description: 'Ausgewogene Auswahl aus Nachrichten, Wirtschaft, Technik und Wissenschaft.',
  },
  public: {
    label: 'Öffentlich-rechtliche Nachrichten',
    sources: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'dw', 'bbc', 'npr'],
    description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC und NPR.',
  },
  analysis: {
    label: 'Analyse & Hintergrund',
    sources: ['zeit', 'faz', 'sueddeutsche', 'handelsblatt', 'spiegel', 'guardian', 'lemonde', 'elpais'],
    description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde und El País.',
  },
  technology: {
    label: 'Technologie & KI',
    sources: ['heise', 'the-decoder', 'golem', 'netzpolitik', 'hackernews', 'arstechnica', 'theverge', 'mit-tech'],
    description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge und MIT Tech.',
  },
  tabloid: {
    label: 'Boulevard & Aktuelles',
    sources: ['bild', 'ntv', 'welt'],
    description: 'BILD, n-tv und WELT.',
  },
} as const;
export type Edition = keyof typeof EDITIONS;

export function applyEditionSources(sources: NewsSource[], edition: Edition): NewsSource[] {
  const preset = EDITIONS[edition] ?? EDITIONS.balanced;
  const ids = new Set<string>(preset.sources);
  return sources.map(source => source.isCustom || clipSourceIds.has(source.id)
    ? source
    : { ...source, subscribed: ids.has(source.id) });
}

export interface AppPreferences {
  language: LanguageSetting;
  accent: 'system' | 'blue' | 'green' | 'violet';
  glass: 'subtle' | 'clear' | 'off';
  corners: 'small' | 'medium' | 'round';
  cards: 'balanced' | 'compact';
  textScale: 'small' | 'normal' | 'large';
  motion: 'system' | 'reduced';
  home: HomeTab;
  retention: Retention;
  edition: Edition;
  sourcePresetApplied?: boolean;
  hero: boolean;
  images: boolean;
  topics: NewsCategory[];
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'system',
  accent: 'system',
  glass: 'subtle',
  corners: 'medium',
  cards: 'balanced',
  textScale: 'normal',
  motion: 'system',
  home: 'Heute',
  retention: '4',
  edition: 'balanced',
  hero: true,
  images: true,
  topics: [],
};
