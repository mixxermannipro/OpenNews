import { DEFAULT_SOURCES } from './catalog';
import type { NewsCategory, NewsSource } from '../types/news';

export const TOPICS = [
  'Politik', 'Wirtschaft', 'Technologie', 'Wissenschaft', 'Europa', 'Gesellschaft', 'Kultur', 'Sport',
] as const satisfies readonly NewsCategory[];

export const HOME_TABS = ['Für dich', 'Alle', 'Schlagzeilen', 'Eilmeldungen', ...TOPICS] as const;
export type HomeTab = typeof HOME_TABS[number];

export const EDITIONS = {
  balanced: { label: 'Ausgewogen', sources: [], description: 'Die Standardauswahl deckt allgemeine Nachrichten, Wirtschaft, Technik und Wissenschaft ab.' },
  public: { label: 'Öffentlich-rechtliche Nachrichten', sources: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'dw'], description: 'Tagesschau, ZDFheute, Deutschlandfunk und Deutsche Welle.' },
  analysis: { label: 'Analyse & Hintergrund', sources: ['zeit', 'faz', 'sueddeutsche', 'handelsblatt', 'spiegel'], description: 'ZEIT, F.A.Z., Süddeutsche Zeitung, Handelsblatt und SPIEGEL.' },
  technology: { label: 'Technologie & KI', sources: ['heise', 'the-decoder', 'golem', 't3n', 'arstechnica'], description: 'heise, THE DECODER, Golem, t3n und Ars Technica.' },
  tabloid: { label: 'Boulevard & Aktuelles', sources: ['bild', 'ntv', 'welt'], description: 'BILD, ntv und WELT.' },
} as const;
export type Edition = keyof typeof EDITIONS;

export function applyEditionSources(sources: NewsSource[], edition: Edition): NewsSource[] {
  const preset = EDITIONS[edition] ?? EDITIONS.balanced;
  const ids = new Set<string>(edition === 'balanced'
    ? DEFAULT_SOURCES.filter(source => source.subscribed).map(source => source.id)
    : preset.sources);
  return sources.map(source => source.isCustom
    ? source
    : { ...source, subscribed: ids.has(source.id) });
}

export interface AppPreferences {
  accent: 'system' | 'blue' | 'green' | 'violet';
  glass: 'subtle' | 'clear' | 'off';
  corners: 'small' | 'medium' | 'round';
  cards: 'balanced' | 'compact';
  textScale: 'small' | 'normal' | 'large';
  motion: 'system' | 'reduced';
  home: HomeTab;
  homeTabs: HomeTab[];
  edition: Edition;
  sourcePresetApplied?: boolean;
  hero: boolean;
  images: boolean;
  topics: NewsCategory[];
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  accent: 'system',
  glass: 'subtle',
  corners: 'medium',
  cards: 'balanced',
  textScale: 'normal',
  motion: 'system',
  home: 'Für dich',
  homeTabs: [...HOME_TABS],
  edition: 'balanced',
  hero: true,
  images: true,
  topics: [],
};

export function resolveHomeTabs(preferences: AppPreferences): HomeTab[] {
  const selected = preferences.homeTabs ?? DEFAULT_PREFERENCES.homeTabs;
  const tabs = HOME_TABS.filter(tab => selected.includes(tab));
  return tabs.length ? tabs : ['Für dich'];
}
