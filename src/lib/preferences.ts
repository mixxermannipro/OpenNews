import type { NewsCategory } from '../types/news';

export const TOPICS = [
  'Politik', 'Wirtschaft', 'Technologie', 'Wissenschaft', 'Europa', 'Gesellschaft', 'Kultur', 'Sport',
] as const satisfies readonly NewsCategory[];

export const HOME_TABS = ['Für dich', 'Alle', 'Schlagzeilen', 'Eilmeldungen', ...TOPICS] as const;
export type HomeTab = typeof HOME_TABS[number];

export const EDITIONS = {
  balanced: { label: 'Ausgewogen', sources: [], description: 'Deine abonnierten Quellen im gewohnten Layout.' },
  public: { label: 'Nachrichten', sources: ['tagesschau', 'zdfheute', 'deutschlandfunk', 'dw'], description: 'Nachrichtenüberblick mit ruhiger Typografie und kompakten Bildern.' },
  analysis: { label: 'Analyse & Hintergrund', sources: ['zeit', 'faz', 'sueddeutsche', 'handelsblatt'], description: 'Politik und Wirtschaft im Magazinlayout.' },
  technology: { label: 'Technologie & KI', sources: ['heise', 'the-decoder', 'golem', 't3n'], description: 'Techniknachrichten und KI mit kompakten Karten.' },
  tabloid: { label: 'Boulevard', sources: ['bild'], description: 'BILD mit großen Bildern und markanten Überschriften.' },
} as const;
export type Edition = keyof typeof EDITIONS;

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
