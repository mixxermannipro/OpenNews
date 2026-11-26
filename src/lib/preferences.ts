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

export const RETENTION_KEYS = ['2', '4', '7', '14', '30', '90'] as const;
export type Retention = typeof RETENTION_KEYS[number];

export function resolveRetention(value: unknown): Retention {
  return typeof value === 'string' && (RETENTION_KEYS as readonly string[]).includes(value)
    ? value as Retention
    : DEFAULT_PREFERENCES.retention;
}

const EDITION_SOURCES = {
  balanced: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'faz', 'spiegel', 'zeit', 'handelsblatt', 'heise', 'guardian', 'nasa', 'dw'],
  public: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'dw', 'bbc', 'npr'],
  analysis: ['zeit', 'faz', 'sueddeutsche', 'handelsblatt', 'spiegel', 'guardian', 'lemonde', 'elpais'],
  technology: ['heise', 'the-decoder', 'golem', 'netzpolitik', 'hackernews', 'arstechnica', 'theverge', 'mit-tech'],
  tabloid: ['bild', 'ntv', 'welt'],
} as const;
export type Edition = keyof typeof EDITION_SOURCES;

export function applyEditionSources(sources: NewsSource[], edition: Edition): NewsSource[] {
  const ids = new Set<string>(EDITION_SOURCES[edition] ?? EDITION_SOURCES.balanced);
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
  fullTextSourceIds?: string[];
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
  fullTextSourceIds: [],
};
