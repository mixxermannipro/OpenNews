import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppLanguage, NewsCategory } from '../types/news';

export type LanguageSetting = AppLanguage | 'system';

export interface AppLanguageMeta {
  code: AppLanguage;
  label: string;
  shortLabel: string;
  locale: string;
}

export const APP_LANGUAGES: readonly AppLanguageMeta[] = [
  { code: 'de', label: 'Deutsch', shortLabel: 'DE', locale: 'de-DE' },
  { code: 'en', label: 'English', shortLabel: 'EN', locale: 'en-US' },
  { code: 'fr', label: 'Français', shortLabel: 'FR', locale: 'fr-FR' },
  { code: 'es', label: 'Español', shortLabel: 'ES', locale: 'es-ES' },
  { code: 'it', label: 'Italiano', shortLabel: 'IT', locale: 'it-IT' },
  { code: 'pt', label: 'Português', shortLabel: 'PT', locale: 'pt-PT' },
] as const;

const SUPPORTED_SET = new Set<string>(APP_LANGUAGES.map(l => l.code));

export function resolveLanguage(setting?: string, browserLanguage?: string): AppLanguage {
  if (setting && setting !== 'system' && SUPPORTED_SET.has(setting)) {
    return setting as AppLanguage;
  }
  const raw = (browserLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : 'de')).toLowerCase();
  const base = raw.split(/[-_]/)[0];
  if (SUPPORTED_SET.has(base)) return base as AppLanguage;
  return 'de';
}

export function languageLocale(lang: AppLanguage): string {
  return APP_LANGUAGES.find(item => item.code === lang)?.locale ?? 'de-DE';
}

import { DE } from './locales/de';

export type TranslationKey = keyof typeof DE;
export type Dictionary = Record<TranslationKey, string>;

const LOADED_DICTIONARIES: Partial<Record<AppLanguage, Dictionary>> = {
  de: DE,
};

const LOADERS: Partial<Record<AppLanguage, () => Promise<Dictionary>>> = {
  en: () => import('./locales/en').then(m => m.EN),
  fr: () => import('./locales/fr').then(m => m.FR),
  es: () => import('./locales/es').then(m => m.ES),
  it: () => import('./locales/it').then(m => m.IT),
  pt: () => import('./locales/pt').then(m => m.PT),
};

export async function loadLanguageDictionary(lang: AppLanguage): Promise<Dictionary> {
  const existing = LOADED_DICTIONARIES[lang];
  if (existing) return existing;
  const loader = LOADERS[lang];
  if (!loader) return DE;
  const loaded = await loader();
  LOADED_DICTIONARIES[lang] = loaded;
  return loaded;
}

export function translate(
  lang: AppLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = LOADED_DICTIONARIES[lang] ?? DE;
  let value = dict[key] ?? DE[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

const CATEGORY_KEY_MAP: Record<NewsCategory, TranslationKey> = {
  Alle: 'catAll',
  'Für dich': 'catForYou',
  Politik: 'catPolitik',
  Wirtschaft: 'catWirtschaft',
  Technologie: 'catTechnologie',
  Wissenschaft: 'catWissenschaft',
  Europa: 'catEuropa',
  Gesellschaft: 'catGesellschaft',
  Kultur: 'catKultur',
  Sport: 'catSport',
};

export function translateCategory(lang: AppLanguage, category: NewsCategory | string): string {
  const key = CATEGORY_KEY_MAP[category as NewsCategory];
  return key ? translate(lang, key) : category;
}

export function translateHomeTab(lang: AppLanguage, tab: 'Heute' | 'Für dich' | 'Neueste'): string {
  if (tab === 'Heute') return translate(lang, 'homeTabToday');
  if (tab === 'Für dich') return translate(lang, 'homeTabForYou');
  return translate(lang, 'homeTabLatest');
}

export function formatRelativeTime(isoDate: string, lang: AppLanguage = 'de', nowMs: number = Date.now()): string {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return '';
  const diffMin = Math.max(0, Math.round((nowMs - timestamp) / 60000));
  if (diffMin < 2) {
    return {
      de: 'Gerade eben',
      en: 'Just now',
      fr: 'À l’instant',
      es: 'Ahora mismo',
      it: 'Proprio ora',
      pt: 'Agora mesmo',
    }[lang];
  }
  if (diffMin < 60) {
    return {
      de: `vor ${diffMin} Min.`,
      en: `${diffMin}m ago`,
      fr: `il y a ${diffMin} min`,
      es: `hace ${diffMin} min`,
      it: `${diffMin} min fa`,
      pt: `há ${diffMin} min`,
    }[lang];
  }
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) {
    return {
      de: `vor ${diffH} Std.`,
      en: `${diffH}h ago`,
      fr: `il y a ${diffH} h`,
      es: `hace ${diffH} h`,
      it: `${diffH} h fa`,
      pt: `há ${diffH} h`,
    }[lang];
  }
  const diffD = Math.round(diffH / 24);
  return {
    de: `vor ${diffD} T.`,
    en: `${diffD}d ago`,
    fr: `il y a ${diffD} j`,
    es: `hace ${diffD} d`,
    it: `${diffD} g fa`,
    pt: `há ${diffD} d`,
  }[lang];
}

export interface I18nValue {
  lang: AppLanguage;
  locale: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  categoryLabel: (category: NewsCategory | string) => string;
  homeTabLabel: (tab: 'Heute' | 'Für dich' | 'Neueste') => string;
  formatRelative: (isoDate: string) => string;
  formatHeaderDate: (date?: Date) => string;
  formatTimelineDate: (date: Date) => string;
  formatTime: (timestamp: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ lang, children }: { lang: AppLanguage; children: React.ReactNode }) {
  const [dictVersion, setDictVersion] = useState(0);

  useEffect(() => {
    if (LOADED_DICTIONARIES[lang]) return;
    let active = true;
    void loadLanguageDictionary(lang).then(() => {
      if (active) setDictVersion(v => v + 1);
    });
    return () => {
      active = false;
    };
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    void dictVersion;
    const locale = languageLocale(lang);
    const headerFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    const timelineFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    return {
      lang,
      locale,
      t: (key, params) => translate(lang, key, params),
      categoryLabel: category => translateCategory(lang, category),
      homeTabLabel: tab => translateHomeTab(lang, tab),
      formatRelative: isoDate => formatRelativeTime(isoDate, lang),
      formatHeaderDate: (date = new Date()) => headerFmt.format(date),
      formatTimelineDate: date => timelineFmt.format(date),
      formatTime: timestamp => timeFmt.format(new Date(timestamp)),
    };
  }, [lang, dictVersion]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const locale = languageLocale('de');
  return {
    lang: 'de',
    locale,
    t: (key, params) => translate('de', key, params),
    categoryLabel: category => translateCategory('de', category),
    homeTabLabel: tab => translateHomeTab('de', tab),
    formatRelative: isoDate => formatRelativeTime(isoDate, 'de'),
    formatHeaderDate: (date = new Date()) => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
    formatTimelineDate: date => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date),
    formatTime: timestamp => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp)),
  };
}
