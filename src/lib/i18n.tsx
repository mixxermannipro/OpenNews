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

const DE = {
  // Navigation
  navHome: 'Heute',
  navDiscover: 'Entdecken',
  navMedia: 'Video & Audio',
  navMediaShort: 'Medien',
  navProfile: 'Profil',
  navMainAria: 'Hauptnavigation',
  navMobileAria: 'Mobile Navigation',

  // Common
  back: 'Zurück',
  cancel: 'Abbrechen',
  save: 'Speichern',
  saveChanges: 'Änderungen speichern',
  close: 'Schließen',
  all: 'Alle',
  clear: 'Leeren',
  loadingView: 'Ansicht wird geladen …',
  loadingArticles: 'Nachrichten werden geladen …',
  refreshing: 'Nachrichten werden aktualisiert',
  refresh: 'Feeds aktualisieren',
  retry: 'Erneut laden',
  share: 'Teilen',
  linkCopied: 'Link kopiert',
  shareUnavailable: 'Teilen gerade nicht möglich',
  like: 'Gefällt mir',
  unlike: 'Gefällt mir entfernen',
  bookmark: 'Artikel speichern',
  unbookmark: 'Lesezeichen entfernen',
  saveShort: 'Speichern',
  openArticle: 'Artikel öffnen',
  breaking: 'Eilmeldung',
  mediaLabel: 'Medien',
  videoLabel: 'Video',
  topStory: 'Top-Thema',
  featuredTopic: 'Schwerpunktthema',
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',

  // Categories
  catAll: 'Alle',
  catForYou: 'Für dich',
  catPolitik: 'Politik',
  catWirtschaft: 'Wirtschaft',
  catTechnologie: 'Technologie',
  catWissenschaft: 'Wissenschaft',
  catEuropa: 'Europa',
  catGesellschaft: 'Gesellschaft',
  catKultur: 'Kultur',
  catSport: 'Sport',

  // Home
  homeTitle: 'Startseite',
  homeAria: 'Startseite Nachrichten',
  homeTabToday: 'Heute',
  homeTabForYou: 'Für dich',
  homeTabLatest: 'Neueste',
  homeTabsAria: 'Ansicht der Startseite',
  homeDescToday: 'Die Tagesagenda aus deinen Quellen.',
  homeDescForYou: 'Aktuelle Vorschläge anhand deiner Interessen auf diesem Gerät.',
  homeDescLatest: 'Nach Veröffentlichungszeit, neueste zuerst.',
  homeUpdatedAt: 'Stand {time}',
  homeHeadlines: 'Schlagzeilen',
  homeMore: 'Weitere Meldungen',
  homeShowMore: 'Weitere Meldungen anzeigen',
  homeNewOne: '1 neue Meldung',
  homeNewMany: '{count} neue Meldungen',
  homeSourcesReport: '{count} Quellen berichten',
  homeMoreReports: 'Weitere Berichte',
  homeNoToday: 'Heute sind noch keine Meldungen verfügbar',
  homeNoForYou: 'Keine aktuellen Empfehlungen verfügbar',
  homeNoLatest: 'Keine Meldungen verfügbar',
  homeGoLatest: 'Zu „Neueste“',
  homeUnreadOnly: 'Nur Ungelesene',
  homeAllReadTitle: 'Alle Meldungen gelesen',
  homeShowAll: 'Alle anzeigen',
  readLabel: 'Gelesen',
  homeNoSourcesTitle: 'Wähle deine Nachrichtenquellen',
  homeNoSourcesDesc: 'Standardmäßig sind keine Quellen vorausgewählt. Stelle dir deinen persönlichen Feed aus über 100 internationalen Quellen zusammen oder starte mit einem Paket.',
  homeChooseSources: 'Quellen auswählen',
  homeStarterPacksHint: 'Oder direkt mit einem Starterpaket loslegen:',

  // Onboarding
  onboardingStepAria: 'Schritt {current} von {total}',
  onboardingTitle0: 'Deine Nachrichten.',
  onboardingDesc0: 'Lies internationale Quellen an einem Ort — ruhig, lokal und in deiner Sprache.',
  onboardingLangLabel: 'App-Sprache',
  onboardingTitle1: 'Wähle deine Quellen',
  onboardingDesc1: 'Starte ganz frei bei null: tippe einzelne Quellen an oder aktiviere ein Starterpaket.',
  onboardingSelectedCount: '{count} ausgewählt',
  onboardingAllSourcesHint: 'Über 100 weitere Quellen findest du jederzeit unter Profil → Quellen.',
  onboardingTitle2: 'Themen & Ansicht',
  onboardingDesc2: 'Wähle Lieblingsthemen für „Für dich“ und dein bevorzugtes Erscheinungsbild.',
  onboardingPreview: 'Vorschau',
  onboardingPreviewTitle: 'Die Nachrichten des Tages',
  onboardingPreviewDesc: 'Was heute wichtig ist, liest du hier — ruhig und übersichtlich.',
  onboardingNext: 'Weiter',
  onboardingStart: 'Nachrichten öffnen',
  onboardingSkip: 'Einrichtung überspringen',
  onboardingMoreSettings: 'Weitere Einstellungen',

  // Sources Manager
  sourcesTitle: 'Quellen',
  sourcesSubtitle: 'Wähle Quellen mit einem Tipp an oder ab.',
  sourcesSearchPlaceholder: 'Name, Land, Sprache, Thema oder Domain …',
  sourcesSearchAria: 'Quellen durchsuchen',
  sourcesSelectedCounter: '{count} aktiv',
  sourcesResultCounter: '{shown} von {total} Quellen',
  sourcesDeselectAll: 'Alle abwählen',
  sourcesSelectVisible: 'Sichtbare anwählen',
  sourcesAddCustomBtn: 'Eigene Quelle',
  sourcesStarterPacks: 'Starterpakete',
  sourcesStarterApply: 'Paket aktivieren',
  sourcesStarterApplied: 'Aktiv',
  sourcesFilterAll: 'Alle',
  sourcesFilterSelected: 'Ausgewählt',
  sourcesFilterNews: 'Nachrichten',
  sourcesFilterMedia: 'Video & Audio',
  sourcesFilterCustom: 'Eigene',
  sourcesLangAll: 'Alle Sprachen',
  sourcesCatAll: 'Alle Themen',
  sourcesSelectAction: 'Auswählen',
  sourcesSelectedAction: 'Aktiv',
  sourcesEmptyTitle: 'Keine passenden Quellen gefunden',
  sourcesEmptyDesc: 'Probiere einen anderen Begriff, ändere den Sprachfilter oder suche direkt auf einer Website nach RSS-Feeds.',
  sourcesResetFilters: 'Filter zurücksetzen',
  sourcesTryWebDiscover: 'Website „{query}“ nach Feed durchsuchen',
  sourcesDiscoverTitle: 'Feed einer Website finden',
  sourcesDiscoverDesc: 'Gib die Adresse einer Website ein, um RSS- oder Atom-Feeds automatisch zu erkennen.',
  sourcesDiscoverBtn: 'Web-Feed finden',
  sourcesDiscoverEmpty: 'Auf dieser Website wurde kein Feed gefunden.',
  sourcesDiscoverError: 'Die Website konnte nicht geladen werden.',
  sourcesDiscoverFound: 'Gefundene Feeds:',
  sourcesAdded: 'Hinzugefügt',
  sourcesAddBtn: 'Hinzufügen',
  sourcesCustomTitle: 'Eigenen RSS-, Atom- oder JSON-Feed hinzufügen',
  sourcesCustomNamePlaceholder: 'Name (z. B. Netzpolitik)',
  sourcesCustomUrlError: 'Bitte einen Namen und eine öffentliche Feed-Adresse mit https:// oder http:// eingeben.',
  sourcesCustomDupError: 'Diese Feed-Adresse ist bereits vorhanden.',
  sourcesCustomDesc: 'Benutzerdefinierter Feed',
  sourcesImportExportTitle: 'OPML Import, Export & Formate',
  sourcesOpmlImport: 'OPML importieren',
  sourcesOpmlExport: 'OPML exportieren',
  sourcesFormats: 'Feed-Formate',
  sourcesEdit: 'Bearbeiten',
  sourcesDelete: 'Löschen',
  sourcesHealthPending: 'Noch nicht geprüft',
  sourcesHealthPaused: 'Nach fünf Fehlern pausiert',
  sourcesHealthFailed: 'Abruf fehlgeschlagen ({count}×)',
  sourcesHealthArticles: '{count} Artikel',
  sourcesHealthReachable: 'Erreichbar · 0 Artikel',

  // Discover
  discoverTitle: 'Entdecken',
  discoverSubtitle: 'Themen und Quellen entdecken',
  discoverSearchPlaceholder: 'Nachrichten, Themen, Quellen',
  discoverRecent: 'Letzte Suchen',
  discoverClearRecent: 'Alle löschen',
  discoverPopularSources: 'Beliebte Quellen',
  discoverAllSources: 'Alle Quellen anzeigen',
  discoverResultsFor: '{count} Meldungen für „{query}“',
  discoverNoResults: 'Keine Ergebnisse für „{query}“',
  discoverNoResultsHint: 'Probiere ein anderes Stichwort oder füge weitere Quellen hinzu.',
  discoverEmptyTopic: 'Keine passenden Beiträge gefunden',
  discoverEmptyTopicHint: 'Versuche ein anderes Thema oder wähle weitere Quellen aus.',
  discoverFollow: 'Folgen',
  discoverFollowing: 'Aktiv',

  // Saved
  savedTitle: 'Gespeichert',
  savedHistoryTitle: 'Leseverlauf',
  savedAlgoTitle: 'Algorithmus',
  savedSubtitle: 'Deine Leseliste, Likes und dein lokaler Algorithmus',
  savedTabBookmarks: 'Gemerkt',
  savedTabLikes: 'Likes',
  savedTabHistory: 'Gelesen',
  savedTabProfile: 'Profil',
  savedClearHistory: 'Verlauf und KI-Ergebnisse löschen',
  savedClearConfirm: 'Leseverlauf und gespeicherte KI-Ergebnisse endgültig löschen?',
  savedClearNow: 'Jetzt löschen',
  savedCleared: 'Leseverlauf und KI-Ergebnisse gelöscht.',
  savedClearError: 'Die KI-Ergebnisse konnten nicht gelöscht werden.',
  savedNoHistory: 'Noch keine Artikel gelesen',
  savedNoHistoryHint: 'Hier erscheinen Artikel, die du geöffnet hast.',
  savedNoBookmarks: 'Noch keine gespeicherten Artikel',
  savedNoBookmarksHint: 'Tippe bei einem Artikel auf das Lesezeichen-Symbol, um ihn offline verfügbar zu halten.',
  savedNoLikes: 'Noch keine Likes vergeben',
  savedNoLikesHint: 'Tippe auf das Herz-Symbol, um OpenNews beizubringen, welche Themen und Quellen dir gefallen.',
  savedLearnedTopics: 'Gelernte Themen-Präferenzen',
  savedReadingTime: 'Lesezeit',
  savedPreferredSources: 'Bevorzugte Anbieter',

  // Media
  mediaTitle: 'Video & Audio',
  mediaSubtitle: 'Nachrichten in Bild und Ton.',
  mediaFilterAll: 'Alle',
  mediaFilterVideo: 'Videos',
  mediaFilterAudio: 'Audio',
  mediaFilterClips: 'Clips',
  mediaAudioSection: 'Audio & Podcasts',
  mediaVideoSection: 'Jetzt ansehen',
  mediaAllAudio: 'Alle Audios',
  mediaAllVideo: 'Alle Videos',
  mediaShortClips: 'Kurze Clips',
  mediaAllClips: 'Alle Clips',
  mediaManageSources: 'Quellen verwalten',
  mediaManageMediaSources: 'Medienquellen verwalten',
  mediaEmpty: 'Hier sind gerade keine passenden Beiträge verfügbar.',
  mediaEmptyNoSources: 'Wähle Video- oder Podcast-Quellen aus, um hier Beiträge zu sehen.',
  mediaLoading: 'Beiträge werden geladen …',
  mediaWatchYoutube: 'Auf YouTube ansehen',
  mediaChannelsAll: 'Alle Kanäle',
  mediaClipsAutoNext: 'Auto-Weiter',
  mediaClipsSwipeHint: 'Hochwischen für nächsten Clip',
  mediaClipsShortsOnly: 'Shorts',
  mediaClipsAllVideos: 'Alle Videos',
  mediaClipsMute: 'Ton aus',
  mediaClipsUnmute: 'Ton an',
  mediaClipsPlay: 'Abspielen',
  mediaClipsPause: 'Pause',
  mediaClipsArticle: 'Artikel',
  mediaClipsNext: 'Nächster Clip',
  mediaClipsPrev: 'Vorheriger Clip',
  mediaStarterHint: 'Starte sofort mit einem Medien-Paket:',
  mediaAudioBack15: '15 Sekunden zurück',
  mediaAudioForward30: '30 Sekunden vor',
  mediaAudioSpeed: 'Wiedergabegeschwindigkeit',
  mediaNowPlaying: 'Läuft gerade',
  mediaMoreCaption: 'Mehr',
  mediaLessCaption: 'Weniger',

  // Reader
  readerTypography: 'Schriftbild anpassen',
  readerFont: 'Schriftart',
  readerTextSize: 'Textgröße',
  readerReadMinutes: '{min} Min. Lesezeit',
  readerSaveOffline: 'Offline speichern',
  readerRemoveOffline: 'Offline-Kopie entfernen',
  readerContinueAtSource: 'Bei der Quelle weiterlesen',
  readerSummary: 'Zusammenfassung',
  readerSummaryTitle: 'Das Wichtigste in Kürze',
  readerLessLikeThis: 'Weniger davon',
  readerReadAloud: 'Vorlesen',
  readerStopAloud: 'Vorlesen beenden',
  readerOpenOriginal: 'Original öffnen',
  readerMoreActions: 'Weitere Artikelaktionen',
  readerLoadingText: 'Artikeltext wird geladen …',
  readerSummaryStyle: 'Zusammenfassungsstil',
  readerAnalyzing: 'Analysiere …',
  readerRunDeviceAI: 'Auf dem Gerät zusammenfassen',
  readerRefreshAI: 'KI aktualisieren',
  readerConnectAI: 'KI-Key verbinden',

  // Briefing
  briefingTrigger: 'Tagesüberblick',
  briefingEmpty: 'Sobald deine Meldungen geladen sind, erscheinen hier die Schlagzeilen.',
  briefingListen: 'Tagesüberblick anhören',
  briefingPause: 'Wiedergabe pausieren',
  briefingResume: 'Wiedergabe fortsetzen',
  briefingStop: 'Wiedergabe stoppen',
  briefingCancel: 'Erstellung abbrechen',

  // Profile & Settings
  profileTitle: 'Profil',
  profileSubtitle: 'Dein Bereich',
  profileTagline: 'Deine Nachrichten,\ndein Überblick.',
  profileStats: '{sources} Quellen · {saved} gespeichert · {read} gelesen',
  profileSaved: 'Gespeichert',
  profileHistory: 'Leseverlauf',
  profileSources: 'Quellen',
  profileTopics: 'Interessen',
  profileSettings: 'Einstellungen',
  profileLanguage: 'Sprache',
  profileContact: 'Kontakt und Feedback',
  settingsAppearance: 'Darstellung',
  settingsFeed: 'Feed & Startseite',
  settingsReader: 'Lesen',
  settingsMotion: 'Navigation & Bewegung',
  settingsPlayback: 'Wiedergabe',
  settingsPrivacy: 'Datenschutz',
  settingsNotifications: 'Benachrichtigungen',
  settingsAI: 'KI & Personalisierung',
  settingsFormatsTitle: 'Quellenoptionen',
  settingsApplyRecommended: 'Empfohlene Einstellungen übernehmen',
  settingsAccent: 'Akzentfarbe',
  settingsGlass: 'Liquid Glass',
  settingsCorners: 'Eckenradius',
  settingsCards: 'Kartenstil',
  settingsTextScale: 'Schriftgröße der App',
  settingsLanguageAuto: 'Systemsprache',
  settingsStartView: 'Ansicht beim Start',
  settingsShowHero: 'Großen Aufmacher zeigen',
  settingsShowImages: 'Vorschaubilder im Feed zeigen',
  settingsRetention: 'Feed-Beiträge aufbewahren',
  settingsArticleFontSize: 'Textgröße im Artikel',
  settingsArticleFont: 'Schrift im Artikel',
  settingsAnimations: 'Animationen',
  settingsBgPlayback: 'Hintergrundwiedergabe',
  settingsBgPlaybackHelp: 'Der Ton direkt abspielbarer Beiträge läuft weiter, wenn du die App verlässt oder dein Gerät sperrst.',
  settingsBackupExport: 'Sicherung exportieren',
  settingsBackupImport: 'Sicherung importieren',
  settingsBackupDesc: 'Sichere Abos, Reaktionen und Lesezeichen als Datei. Beim Import werden die Einträge zusammengeführt.',
  settingsPrivacyNote1: 'Deine Einstellungen, Interessen und Leseliste werden auf diesem Gerät gespeichert. OpenNews braucht dafür kein Konto.',
  settingsPrivacyNote2: 'Beim Abrufen von Nachrichten verbindet sich OpenNews mit den ausgewählten Quellen. Wenn du eine externe KI verwendest, erhält der Anbieter den Artikeltext für die Analyse.',
  settingsPrivacyContact: 'Datenschutzkontakt',
  settingsPrivacyPolicy: 'Vollständige Datenschutzerklärung',
  settingsImprint: 'Impressum',
  offlineBanner: 'Offline-Modus — Zwischengespeicherte Nachrichten aktiv',
  rateLimitBanner: 'Der Server erhält zu viele Anfragen. Bitte versuche die Feed-Aktualisierung später erneut.',
  storageFailedBanner: 'Artikel konnten nicht dauerhaft gespeichert werden. Prüfe den freien Speicher deines Geräts.',
  installApp: 'App installieren',
  installedApp: 'Als App installiert',
  installOnPhone: 'Auf Smartphone installieren',
  installOnIOS: 'Auf iOS installieren',
  understood: 'Verstanden',

  // Editorial types & Clarifier
  typeOpinion: 'Meinung',
  typeAnalysis: 'Analyse',
  typeInterview: 'Interview',
  typeFactcheck: 'Faktencheck',
  clickbaitShort: 'Kurz gesagt',

  // Daily Briefing 2.0
  briefingQuickNotes: 'Kurz notiert',
  briefingEnhanceAI: 'Mit KI vertiefen',
  briefingReadMin: '{min} Min.',
  briefingSourcesCount: '{count} Quellen',

  // Reader Focus, Themes, Speech 2.0, Highlights, Queue, Related Media & Context
  readerNewspaperMode: 'Zeitungsmodus',
  readerNewspaperColumns: 'Zwei Spalten',
  readerThemeLabel: 'Lesethema',
  readerThemeDefault: 'Standard',
  readerThemeSepia: 'Sepia',
  readerThemePaper: 'Papier',
  readerThemeNight: 'Nacht',
  readerSpeechPrev: 'Vorheriger Absatz',
  readerSpeechNext: 'Nächster Absatz',
  readerSpeechSleep: 'Sleep-Timer',
  readerSpeechOff: 'Aus',
  readerHighlightAdd: 'Markieren',
  readerHighlightSaved: 'Zitat gespeichert',
  readerQueueAdd: 'Als Nächstes lesen',
  readerQueueAdded: 'In Warteschlange',
  readerQueueNext: 'Als Nächstes',
  readerRelatedMedia: 'Passend zum Thema',
  readerWatchInApp: 'In der App ansehen',
  readerListenInApp: 'Anhören',
  readerContextTitle: 'Was bisher geschah',
  readerContextLoad: 'Hintergrund mit KI einordnen',
  readerContextPrior: 'Frühere Meldungen aus deinen Quellen',
  readerOfflineReady: 'Offline bereit',

  // Discover Radar & Mute Filters
  discoverTrending: 'Gerade viel besprochen',
  discoverSourcesCount: '{count} Quellen',
  discoverRadarTitle: 'Stichwort-Radar',
  discoverRadarPlaceholder: 'Thema verfolgen (z. B. KI, Klima) …',
  discoverRadarAdd: 'Verfolgen',
  discoverMuteTitle: 'Stummschalt-Filter',
  discoverMutePlaceholder: 'Begriff stummschalten …',
  discoverMuteAdd: 'Ausblenden',
  discoverMute24h: '24 Std.',
  discoverMute7d: '7 Tage',
  discoverMuteForever: 'Dauerhaft',
  discoverFilterSection: 'Radar & Filter',

  // Saved Queue & Quotes
  savedTabQueue: 'Warteschlange',
  savedTabQuotes: 'Zitate',
  savedExportMarkdown: 'Als Markdown kopieren',
  savedExportCopied: 'Markdown kopiert',
  savedQueueEmpty: 'Deine Warteschlange ist leer',
  savedQueueEmptyHint: 'Füge Artikel über „Als Nächstes lesen“ hinzu, um sie nacheinander zu lesen.',
  savedQuotesEmpty: 'Noch keine Markierungen',
  savedQuotesEmptyHint: 'Markiere Text im Artikel, um Zitate lokal zu sammeln.',
  savedQueueSummary: '{count} Artikel · ca. {min} Min.',

  // Mini Audio Player
  miniPlayerResume: 'Fortsetzen ab {time}',
  miniPlayerClose: 'Player schließen',

  // Swipe-to-Dismiss & Feed Caught-Up
  swipeLessLikeThis: 'Weniger davon',
  swipeDismissedToast: 'Weniger zu {category} · {source}',
  undo: 'Rückgängig',
  feedCaughtUpTitle: 'Du bist auf dem neuesten Stand',
  feedCaughtUpHint: 'Alle Meldungen von heute gesehen.',

  // Multi-Provider TTS
  ttsTitle: 'Vorlesen & Stimmen (TTS)',
  ttsSubtitle: 'Systemstimme oder eigene KI-Stimmen pro Szenario',
  ttsProviderLabel: 'Vorlese-Anbieter',
  ttsScenarioArticle: 'Artikel',
  ttsScenarioBriefing: 'Tagesüberblick',
  ttsScenarioFocus: 'Ruhiger Fokus',
  ttsVoiceLabel: 'Stimme',
  ttsModelLabel: 'Sprachmodell',
  ttsTestVoice: 'Stimme testen',
  ttsTesting: 'Erzeuge Stimme…',
  ttsUseMainKeyHint: 'Leer lassen, um den API-Key von oben mitzunutzen.',
  ttsFallbackHint: 'Cloud-Stimme nicht erreichbar — Systemstimme aktiv.',
  ttsLoadingAudio: 'Stimme wird geladen…',
} as const;

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
