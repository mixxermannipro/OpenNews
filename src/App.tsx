import type { AndroidAutoSettings } from './lib/androidAuto';
import type { WidgetLaunch } from './lib/newsWidget';
import type { DailyBriefingSettings } from './lib/dailyBriefing';
import { clusterStories } from './lib/storyClusters';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Bell, Compass, Home, Clapperboard, User } from 'lucide-react';
import type {
  AIProviderConfig,
  AppTab,
  FormatPreferences,
  FeedHealth,
  FeedResult,
  NewsArticle,
  NewsSource,
  NotificationSettings,
  PersonalizationProfile,
  ReaderFontFamily,
  ReaderFontSize,
  ThemeMode,
  TTSProviderConfig,
} from './types/news';
import { DEFAULT_AI_CONFIG, migrateAIConfig } from './lib/aiConfig';
import { clipSourceIds, DEFAULT_SOURCES, legacyCatalogUrls, pushSources } from './lib/catalog';
import {
  createDefaultProfile,
  decayProfileWeights,
  dismissArticleLessLikeThis,
  resetProfileWeights,
  normalizeProfile,
  recordArticleRead,
  recordReadingDuration,
  rankArticlesForYou,
  toggleArticleBookmark,
  toggleArticleDislike,
  toggleArticleLike,
} from './lib/personalization';
import { articleIdentity, buildHomeSections, distinctArticles, hydrateArticles, mergeFeedArticles, pruneFeedArticles } from './lib/newsFeed';
import { planFeedBatches, runWithConcurrency } from './lib/feedRefresh';
import { trackNavigationScroll } from './lib/scrollNavigation';
import { useArticleStorage } from './hooks/useArticleStorage';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ViewStatus } from './components/ViewStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { recordDiagnostic } from './lib/diagnostics';
import {
  isWebKeyPersistenceEnabled,
  readWebSecret,
  setWebKeyPersistence,
  writeWebSecret,
} from './lib/webSecretStorage';
import type { SettingsSectionTab } from './components/SettingsView';

import { OfflineIndicator } from './components/PWAInstallButton';

import { DEFAULT_PREFERENCES, applyEditionSources, resolveHomeTab, resolveRetention, type AppPreferences, type HomeTab } from './lib/preferences';
import { I18nProvider, resolveLanguage, translate } from './lib/i18n';
import type { ProfilePage } from './components/Preferences';
import { createMuteRule, filterMutedArticles, pruneExpiredMutes, type MuteDuration, type MutedKeywordRule } from './lib/keywordFilter';
import {
  resolveNeighborArticles,
  upsertAudioPosition,
  upsertReadingProgress,
  type ArticleHighlight,
  type AudioPositionEntry,
  type ReaderSurfaceTheme,
  type ReadingProgressEntry,
} from './lib/readerExtras';
import type { ActiveAudioTrack } from './components/MiniAudioPlayer';
import type { PlayableMedia } from './lib/articleMedia';

const AudioBriefing = lazy(() => import('./components/AudioBriefing').then(module => ({ default: module.AudioBriefing })));
const DiscoverView = lazy(() => import('./components/DiscoverView').then(module => ({ default: module.DiscoverView })));
const SavedView = lazy(() => import('./components/SavedView').then(module => ({ default: module.SavedView })));
const MediaView = lazy(() => import('./components/MediaView').then(module => ({ default: module.MediaView })));
const ArticleReaderModal = lazy(() => import('./components/ArticleReaderModal').then(module => ({ default: module.ArticleReaderModal })));
const SettingsView = lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));
const MiniAudioPlayer = lazy(() => import('./components/MiniAudioPlayer').then(module => ({ default: module.MiniAudioPlayer })));
const Onboarding = lazy(() => import('./components/Preferences').then(module => ({ default: module.Onboarding })));
const ProfileView = lazy(() => import('./components/Preferences').then(module => ({ default: module.ProfileView })));

type AppLocation = {
  tab: AppTab;
  profile: ProfilePage;
  settings: SettingsSectionTab;
  saved: 'bookmarks' | 'history';
  article: NewsArticle | null;
  summary?: boolean;
  briefing?: boolean;
};
const HOME_LOCATION: AppLocation = { tab: 'home', profile: 'profile', settings: 'overview', saved: 'bookmarks', article: null };

// Lightweight inline default so ttsClient.ts stays strictly inside lazy chunks (<= 170 KiB gzip initial JS)
const INITIAL_TTS_CONFIG: TTSProviderConfig = {
  provider: 'system',
  apiKey: '',
  model: 'system',
  voice: 'default',
  customEndpoint: '',
  scenarios: {
    article: { model: 'system', voice: 'default', speed: 1 },
    briefing: { model: 'system', voice: 'default', speed: 1.05 },
    focus: { model: 'system', voice: 'default', speed: 0.92 },
  },
};

const INITIAL_ANDROID_AUTO_SETTINGS: AndroidAutoSettings = {
  mode: 'all_audio',
  autoplayQueue: true,
  showLiveRadio: true,
  directFeedRefresh: true,
  wifiPrebuffer: true,
};

export default function App() {
  const [location, setLocation] = useState<AppLocation>(HOME_LOCATION);
  const { tab: activeTab, settings: settingsSection, profile: profilePage, saved: savedPage, article: activeArticle } = location;
  const navigate = (next: Partial<AppLocation>) => {
    const destination = { ...location, article: null, summary: false, briefing: false, ...next };
    if (
      destination.tab === location.tab
      && destination.profile === location.profile
      && destination.settings === location.settings
      && destination.saved === location.saved
      && destination.article?.id === location.article?.id
      && Boolean(destination.summary) === Boolean(location.summary)
      && Boolean(destination.briefing) === Boolean(location.briefing)
    ) {
      return;
    }
    window.history.pushState({ openNews: destination }, '');
    setLocation(destination);
  };
  const goBack = useCallback(() => {
    if (window.history.state?.openNews) window.history.back();
  }, []);
  useEffect(() => {
    window.history.replaceState(null, '');
    const restore = (event: PopStateEvent) => {
      const next: AppLocation = event.state?.openNews ?? HOME_LOCATION;
      setLocation(current => next.article && next.article.id === current.article?.id
        ? { ...next, article: current.article }
        : next);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const [storedPreferences, setPreferences] = useLocalStorage<AppPreferences>('opennews_preferences', DEFAULT_PREFERENCES);
  const preferences = useMemo<AppPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    ...(storedPreferences && typeof storedPreferences === 'object' ? storedPreferences : {}),
    topics: Array.isArray(storedPreferences?.topics) ? storedPreferences.topics : DEFAULT_PREFERENCES.topics,
  }), [storedPreferences]);
  const activeLanguage = useMemo(() => resolveLanguage(preferences.language), [preferences.language]);
  const t = useCallback(
    (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(activeLanguage, key, params),
    [activeLanguage],
  );
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = preferences.motion;
    document.documentElement.lang = activeLanguage;
  }, [preferences.motion, activeLanguage]);
  const [briefingSettings, setBriefingSettings] = useLocalStorage<DailyBriefingSettings>('opennews_daily_briefing', { enabled: false, time: '07:30' });
  const [homeCategory, setHomeCategory] = useState<HomeTab>(() => resolveHomeTab(preferences.home));
  const retention = resolveRetention(preferences.retention);
  useEffect(() => {
    const prune = () => void import('./lib/aiCache').then(({ pruneAIResults }) => pruneAIResults(retention)).catch(() => {});
    prune();
    const timer = window.setInterval(prune, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [retention]);
  const latestRetention = useRef(retention);
  useLayoutEffect(() => { latestRetention.current = retention; }, [retention]);
  const [onboarded, setOnboarded] = useLocalStorage('opennews_onboarded', false);
  const [autoTranslate, setAutoTranslate] = useLocalStorage('opennews_auto_translate', false);
  const [backgroundPlayback, setBackgroundPlayback] = useLocalStorage('opennews_background_playback', false);
  const [theme, setTheme] = useLocalStorage<ThemeMode>('opennews_theme', 'system');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab, profilePage, settingsSection, savedPage, onboarded, homeCategory]);
  const [navigationHidden, setNavigationHidden] = useState(false);
  useLayoutEffect(() => {
    setNavigationHidden(false);
    if (!onboarded || activeArticle) return;

    const scroller = document.scrollingElement ?? document.documentElement;
    const trackScroll = trackNavigationScroll(Math.max(0, scroller.scrollTop));
    let hidden = false;

    const onScroll = () => {
      const nextHidden = trackScroll(scroller.scrollTop, scroller.scrollHeight - scroller.clientHeight);
      if (nextHidden === hidden) return;
      hidden = nextHidden;
      setNavigationHidden(hidden);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location, activeArticle, onboarded, homeCategory]);

  const [storedSources, setSources] = useLocalStorage<NewsSource[]>('opennews_sources', DEFAULT_SOURCES);
  const sources = useMemo(() => {
    const saved = new Map(storedSources.map(source => [source.id, source]));
    return [
      ...storedSources.filter(source => source.isCustom),
      ...DEFAULT_SOURCES.map(source => {
        const previous = saved.get(source.id);
        if (!previous) return source;
        const url = previous.url === legacyCatalogUrls[source.id] ? source.url : previous.url;
        return {
          ...source,
          ...previous,
          region: previous.region ?? source.region,
          tags: previous.tags ?? source.tags,
          url,
          format: url === source.url && source.id === 'hackernews' ? source.format : previous.format,
        };
      }),
    ];
  }, [storedSources]);
  const applySourcePreset = (edition: AppPreferences['edition']) => {
    setSources(applyEditionSources(sources, edition));
  };

  const updatePreferences = (next: AppPreferences) => {
    if (next.home !== preferences.home) setHomeCategory(resolveHomeTab(next.home));
    if (next.edition !== preferences.edition) applySourcePreset(next.edition);
    setPreferences({ ...next, sourcePresetApplied: true });
  };

  useEffect(() => {
    if (!preferences.sourcePresetApplied && preferences.edition && preferences.edition !== 'balanced') {
      applySourcePreset(preferences.edition);
      setPreferences({ ...preferences, sourcePresetApplied: true });
    }
  }, [preferences, sources]);
  const [profile, setProfile] = useLocalStorage<PersonalizationProfile>(
    'opennews_profile',
    createDefaultProfile()
  );
  const [storedAIConfig, setAiConfig] = useLocalStorage<AIProviderConfig>(
    'opennews_ai_config',
    DEFAULT_AI_CONFIG
  );
  const [aiConfigMigrated, setAIConfigMigrated] = useLocalStorage('opennews_ai_aliases_migrated', false);
  const [androidAIKey, setAndroidAIKey] = useState<string>('');
  const [androidTTSKey, setAndroidTTSKey] = useState<string>('');
  const [storedTTSConfig, setStoredTTSConfig] = useLocalStorage<TTSProviderConfig>(
    'opennews_tts_config',
    INITIAL_TTS_CONFIG
  );
  const isAndroidPlatform = Capacitor.getPlatform() === 'android';
  const [persistWebKeys, setPersistWebKeys] = useState<boolean>(() => isWebKeyPersistenceEnabled());
  const [webAIKey, setWebAIKey] = useState<string>(() => (isAndroidPlatform ? '' : readWebSecret('ai_api_key')));
  const [webTTSKey, setWebTTSKey] = useState<string>(() => (isAndroidPlatform ? '' : readWebSecret('tts_api_key')));

  useEffect(() => {
    if (!isAndroidPlatform) return;
    let active = true;
    void import('./lib/secureSecrets').then(async ({ getSecureSecret, setSecureSecret }) => {
      const legacyAI = storedAIConfig.apiKey?.trim() || '';
      const legacyTTS = storedTTSConfig.apiKey?.trim() || '';
      const storedAI = (await getSecureSecret('ai_api_key')) ?? '';
      const storedTTS = (await getSecureSecret('tts_api_key')) ?? '';

      let finalAI = storedAI;
      if (!finalAI && legacyAI) {
        if (await setSecureSecret('ai_api_key', legacyAI)) {
          finalAI = legacyAI;
          setAiConfig(prev => ({ ...prev, apiKey: '' }));
        }
      } else if (storedAI && legacyAI) {
        setAiConfig(prev => ({ ...prev, apiKey: '' }));
      }

      let finalTTS = storedTTS;
      if (!finalTTS && legacyTTS) {
        if (await setSecureSecret('tts_api_key', legacyTTS)) {
          finalTTS = legacyTTS;
          setStoredTTSConfig(prev => ({ ...prev, apiKey: '' }));
        }
      } else if (storedTTS && legacyTTS) {
        setStoredTTSConfig(prev => ({ ...prev, apiKey: '' }));
      }

      if (active) {
        if (finalAI) setAndroidAIKey(finalAI);
        if (finalTTS) setAndroidTTSKey(finalTTS);
      }
    }).catch(() => {});
    return () => { active = false; };
  // Intentionally runs on mount to hydrate/migrate Keystore secrets on Android
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aiConfig = useMemo(() => {
    const base = aiConfigMigrated ? storedAIConfig : migrateAIConfig(storedAIConfig);
    if (isAndroidPlatform && androidAIKey && !base.apiKey) {
      return { ...base, apiKey: androidAIKey };
    }
    if (!isAndroidPlatform && webAIKey && !base.apiKey) {
      return { ...base, apiKey: webAIKey };
    }
    return base;
  }, [storedAIConfig, aiConfigMigrated, isAndroidPlatform, androidAIKey, webAIKey]);

  const updateAIConfig = useCallback((next: AIProviderConfig) => {
    const trimmedKey = next.apiKey.trim();
    if (isAndroidPlatform) {
      setAndroidAIKey(trimmedKey);
      void import('./lib/secureSecrets').then(async ({ removeSecureSecret, setSecureSecret }) => {
        if (trimmedKey) {
          const ok = await setSecureSecret('ai_api_key', trimmedKey);
          if (ok) {
            setAiConfig({ ...next, apiKey: '' });
            return;
          }
        } else {
          await removeSecureSecret('ai_api_key');
        }
        setAiConfig({ ...next, apiKey: '' });
      }).catch(() => setAiConfig(next));
    } else {
      setWebAIKey(trimmedKey);
      writeWebSecret('ai_api_key', trimmedKey, persistWebKeys);
      setAiConfig(persistWebKeys ? { ...next, apiKey: trimmedKey } : { ...next, apiKey: '' });
    }
    setAIConfigMigrated(true);
  }, [isAndroidPlatform, persistWebKeys, setAiConfig, setAIConfigMigrated]);

  const ttsConfig = useMemo(() => {
    if (isAndroidPlatform && androidTTSKey && !storedTTSConfig.apiKey) {
      return { ...storedTTSConfig, apiKey: androidTTSKey };
    }
    if (!isAndroidPlatform && webTTSKey && !storedTTSConfig.apiKey) {
      return { ...storedTTSConfig, apiKey: webTTSKey };
    }
    return storedTTSConfig;
  }, [storedTTSConfig, isAndroidPlatform, androidTTSKey, webTTSKey]);

  const updateTTSConfig = useCallback((next: TTSProviderConfig) => {
    const trimmedKey = next.apiKey.trim();
    if (isAndroidPlatform) {
      setAndroidTTSKey(trimmedKey);
      void import('./lib/secureSecrets').then(async ({ removeSecureSecret, setSecureSecret }) => {
        if (trimmedKey) {
          const ok = await setSecureSecret('tts_api_key', trimmedKey);
          if (ok) {
            setStoredTTSConfig({ ...next, apiKey: '' });
            return;
          }
        } else {
          await removeSecureSecret('tts_api_key');
        }
        setStoredTTSConfig({ ...next, apiKey: '' });
      }).catch(() => setStoredTTSConfig(next));
    } else {
      setWebTTSKey(trimmedKey);
      writeWebSecret('tts_api_key', trimmedKey, persistWebKeys);
      setStoredTTSConfig(persistWebKeys ? { ...next, apiKey: trimmedKey } : { ...next, apiKey: '' });
    }
  }, [isAndroidPlatform, persistWebKeys, setStoredTTSConfig]);

  const handleTogglePersistWebKeys = useCallback((persist: boolean) => {
    setPersistWebKeys(persist);
    setWebKeyPersistence(persist, { aiKey: webAIKey, ttsKey: webTTSKey });
    setAiConfig(prev => ({ ...prev, apiKey: persist ? webAIKey : '' }));
    setStoredTTSConfig(prev => ({ ...prev, apiKey: persist ? webTTSKey : '' }));
  }, [webAIKey, webTTSKey, setAiConfig, setStoredTTSConfig]);

  const [formatPrefs, setFormatPrefs] = useLocalStorage<FormatPreferences>('opennews_formats', {
    rssAtom: true,
    jsonFeed: true,
    openData: true,
    podcasts: false,
  });
  const [notifications, setNotifications] = useLocalStorage<NotificationSettings>(
    'opennews_notifications',
    { enabled: false, breakingOnly: false, topics: [] }
  );
  const [fontSize, setFontSize] = useLocalStorage<ReaderFontSize>('opennews_font_size', 'normal');
  const [fontFamily, setFontFamily] = useLocalStorage<ReaderFontFamily>(
    'opennews_font_family',
    'sans'
  );
  const [readerTheme, setReaderTheme] = useLocalStorage<ReaderSurfaceTheme>('opennews_reader_theme', 'paper');
  const [newspaperMode, setNewspaperMode] = useLocalStorage<boolean>('opennews_newspaper_mode', false);
  const [mutedKeywords, setMutedKeywords] = useLocalStorage<MutedKeywordRule[]>('opennews_muted_keywords', []);
  const [trackedKeywords, setTrackedKeywords] = useLocalStorage<string[]>('opennews_tracked_keywords', []);
  const [highlights, setHighlights] = useLocalStorage<ArticleHighlight[]>('opennews_highlights', []);
  const [readingQueueIds, setReadingQueueIds] = useLocalStorage<string[]>('opennews_reading_queue', []);
  const [readingProgress, setReadingProgress] = useLocalStorage<Record<string, ReadingProgressEntry>>('opennews_reading_progress', {});
  const [audioPositions, setAudioPositions] = useLocalStorage<Record<string, AudioPositionEntry>>('opennews_audio_positions', {});
  const [radioFavorites, setRadioFavorites] = useLocalStorage<string[]>('opennews_radio_favorites', []);
  const [androidAutoSettings, setAndroidAutoSettings] = useLocalStorage<AndroidAutoSettings>(
    'opennews_android_auto',
    INITIAL_ANDROID_AUTO_SETTINGS,
  );
  const [activeAudio, setActiveAudio] = useState<ActiveAudioTrack | null>(null);
  const [audioQueue, setAudioQueue] = useState<ActiveAudioTrack[]>([]);
  const [briefingActive, setBriefingActive] = useState(false);
  const [briefingStopSignal, setBriefingStopSignal] = useState(0);
  const [readerContextList, setReaderContextList] = useState<NewsArticle[]>([]);
  const [pendingClipUrl, setPendingClipUrl] = useState<string | undefined>(undefined);

  const [cachedLiveArticles, setCachedLiveArticles, cachedStorageFailed, cachedStorageReady] = useArticleStorage<NewsArticle[]>(
    'opennews_cached_articles',
    []
  );
  const [feedRateLimited, setFeedRateLimited] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [readerFeedSnapshot, setReaderFeedSnapshot] = useState<ReturnType<typeof buildHomeSections>[HomeTab] | null>(null);
  useEffect(() => { setReaderFeedSnapshot(null); }, [activeTab, homeCategory]);
  const [feedClock, setFeedClock] = useState(Date.now);
  useEffect(() => {
    const updateClock = () => {
      if (!document.hidden) {
        setFeedClock(prev => (Date.now() - prev >= 180_000 ? Date.now() : prev));
      }
    };
    const timer = window.setInterval(updateClock, 300_000);
    document.addEventListener('visibilitychange', updateClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateClock);
    };
  }, []);
  const [savedArticles, setSavedArticles, savedStorageFailed] = useArticleStorage<Record<string, NewsArticle>>(
    'opennews_saved_articles',
    {}
  );
  const refresh = useRef<AbortController | null>(null);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  const [readArticles, setReadArticles, historyStorageFailed] = useArticleStorage<NewsArticle[]>('opennews_read_articles', []);
  useEffect(() => {
    if (cachedStorageFailed || savedStorageFailed || historyStorageFailed) {
      recordDiagnostic('storage-failed');
    }
  }, [cachedStorageFailed, savedStorageFailed, historyStorageFailed]);
  const [alertBanner, setAlertBanner] = useState<{ title: string; source: string } | null>(null);
  const [osReducedMotion, setOsReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setOsReducedMotion(event.matches);
    setOsReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Sync theme class with <html>, including live prefers-color-scheme listener for 'system'
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedDark = theme === 'system' ? media.matches : theme === 'dark';
      if (resolvedDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      if (Capacitor.isNativePlatform()) {
        void SystemBars.setStyle({ style: resolvedDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
      }
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', resolvedDark ? '#0f1013' : '#f5f3ee');
      }
    };

    applyTheme();
    if (theme === 'system') {
      media.addEventListener('change', applyTheme);
      return () => media.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  // Escape key closes Article Reader
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeArticle && !location.summary) {
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeArticle, goBack, location.summary]);

  const enabledFormats = useMemo(() => {
    return new Set<string>([
      ...(formatPrefs.rssAtom ? ['rss', 'atom'] : []),
      ...(formatPrefs.jsonFeed ? ['json'] : []),
      ...(formatPrefs.openData ? ['opendata'] : []),
      ...(formatPrefs.podcasts ? ['podcast'] : []),
    ]);
  }, [formatPrefs]);

  const [feedHealth, setFeedHealth] = useLocalStorage<Record<string, FeedHealth>>('opennews_feed_health', {});

  const activeSources = useMemo(
    () => sources.filter((s) => s.subscribed && (enabledFormats.has(s.format) || s.isCustom || clipSourceIds.has(s.id))),
    [sources, enabledFormats]
  );

  const pushSyncVersion = useRef(0);
  const [pushStatus, setPushStatus] = useState('');
  const [pushPermissionDenied, setPushPermissionDenied] = useState(false);
  const [requestingPushPermission, setRequestingPushPermission] = useState(false);
  const activeMutedRules = useMemo(
    () => pruneExpiredMutes(mutedKeywords, feedClock),
    [mutedKeywords, feedClock],
  );

  const pushSourceIds = useMemo(() => activeSources
    .filter(source => pushSources.some(candidate => candidate.id === source.id && candidate.url === source.url))
    .map(source => source.id), [activeSources]);

  const configurePush = useCallback(async (settings: NotificationSettings) => {
    if (Capacitor.getPlatform() !== 'android') return;
    const version = ++pushSyncVersion.current;
    try {
      const { NewsPush } = await import('./lib/newsPush');
      const feeds = activeSources
        .filter(source => source.format !== 'podcast')
        .slice(0, 25)
        .map(source => ({
          id: source.id,
          name: source.name,
          url: source.url,
          category: source.category,
          accentColor: source.accentColor,
          shortCode: source.shortCode,
        }));
      const mutedKeywords = activeMutedRules.map(rule => rule.keyword);
      const { status, mode } = await NewsPush.configure({
        ...settings,
        sources: pushSourceIds,
        feeds,
        mutedKeywords,
      });
      if (!settings.enabled || version !== pushSyncVersion.current) return;
      setPushPermissionDenied(status === 'denied');
      setPushStatus(status === 'unconfigured' ? 'Dieser Build hat noch keine Benachrichtigungs-Konfiguration.'
        : status === 'denied' ? 'Erlaube Benachrichtigungen in den Android-Einstellungen.'
        : settings.enabled && !feeds.length ? 'Aktiviere mindestens eine Nachrichtenquelle.'
        : settings.enabled && mode === 'local'
          ? `Hintergrund-Check auf dem Gerät aktiv (alle ${settings.intervalMinutes ?? 30} Min.).`
        : settings.enabled ? 'Push & Hintergrund-Check für deine Quellen aktiv.' : '');
    } catch {
      if (settings.enabled && version === pushSyncVersion.current) setPushStatus('Push-Anmeldung gerade nicht möglich.');
    }
  }, [activeMutedRules, activeSources, pushSourceIds]);

  useEffect(() => {
    const sync = () => { if (!document.hidden) void configurePush(notifications); };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
    };
  }, [configurePush, notifications]);

  useEffect(() => {
    if (profile.weightsUpdatedAt === undefined) setProfile(previous => decayProfileWeights(normalizeProfile(previous)));
  }, [profile.weightsUpdatedAt, setProfile]);

  const normalizedProfile = useMemo(() => decayProfileWeights(normalizeProfile(profile), feedClock), [profile, feedClock]);

  // Keep a copy of saved and queued articles even when they leave the feed or it is paused.
  const savedIds = useMemo(
    () => new Set([...normalizedProfile.bookmarkedIds, ...normalizedProfile.likedIds, ...readingQueueIds]),
    [normalizedProfile, readingQueueIds]
  );
  useEffect(() => {
    setSavedArticles(previous => {
      const entries = new Map(Object.entries(previous).filter(([id]) => savedIds.has(id)));
      for (const article of [...cachedLiveArticles, ...readArticles]) {
        if (savedIds.has(article.id) && !entries.has(article.id)) entries.set(article.id, article);
      }
      if (entries.size === Object.keys(previous).length
        && [...entries.keys()].every(id => Object.hasOwn(previous, id))) return previous;
      return Object.fromEntries(entries);
    });
  }, [cachedLiveArticles, readArticles, savedIds, setSavedArticles]);

  useEffect(() => {
    setCachedLiveArticles(previous => pruneFeedArticles(previous, retention, Date.now()));
  }, [feedClock, retention, setCachedLiveArticles]);

  const announcedArticles = useRef(new Set<string>());
  const feedHasLoaded = useRef(false);
  useEffect(() => {
    if (cachedStorageReady && cachedLiveArticles.length) feedHasLoaded.current = true;
  }, [cachedStorageReady, cachedLiveArticles.length]);
  const alertTimer = useRef<number | undefined>(undefined);
  const showAlert = useCallback((title: string, source: string) => {
    window.clearTimeout(alertTimer.current);
    setAlertBanner({ title, source });
    alertTimer.current = window.setTimeout(() => setAlertBanner(null), 5000);
  }, []);
  useEffect(() => () => window.clearTimeout(alertTimer.current), []);
  const initialArticleIds = useRef(new Set(cachedLiveArticles.map(articleIdentity)));

  const checkForAlert = useCallback((articles: NewsArticle[]) => {
    const firstLoad = !feedHasLoaded.current;
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const from = notifications.from ?? '00:00';
    const until = notifications.until ?? '23:59';
    const withinWindow = from <= until ? time >= from && time <= until : time >= from || time <= until;
    let candidate: NewsArticle | undefined;
    for (const article of articles) {
      const identity = articleIdentity(article);
      if (announcedArticles.current.has(identity) || initialArticleIds.current.has(identity)) continue;
      announcedArticles.current.add(identity);
      const age = now.getTime() - Date.parse(article.publishedAt);
      if (!candidate && age >= 0 && age <= 2 * 60 * 60_000
        && (notifications.breakingOnly ? article.isBreaking : !notifications.topics.length || notifications.topics.includes(article.category))) {
        candidate = article;
      }
    }
    if (!firstLoad && notifications.enabled && withinWindow && candidate) {
      if (document.visibilityState === 'visible') {
        showAlert(candidate.title, candidate.sourceName);
      } else if (
        Capacitor.getPlatform() === 'web'
        && 'Notification' in window
        && Notification.permission === 'granted'
      ) {
        const tag = articleIdentity(candidate);
        void navigator.serviceWorker?.ready
          ?.then(reg => reg.showNotification(candidate.title, {
            body: candidate.sourceName,
            icon: '/pwa-192x192.png',
            tag,
          }))
          .catch(() => {
            try {
              new Notification(candidate.title, { body: candidate.sourceName, tag });
            } catch {
              // Ignore restricted notification contexts
            }
          });
      }
    }
  }, [notifications, showAlert]);

  useEffect(() => {
    if (!sources.some(source => source.subscribed && feedHealth[source.id]?.url === source.url && feedHealth[source.id].consecutiveFailures >= 5)) return;
    setSources(previous => previous.map(source => source.subscribed && feedHealth[source.id]?.url === source.url
      && feedHealth[source.id].consecutiveFailures >= 5 ? { ...source, subscribed: false } : source));
  }, [sources, feedHealth, setSources]);

  const latestHomeStories = useRef<ReturnType<typeof buildHomeSections>[HomeTab]>([]);

  const fetchLiveFeeds = useCallback(async (force = false) => {
    if (!cachedStorageReady || refresh.current || !activeSources.length || !navigator.onLine) return;
    const controller = new AbortController();
    refresh.current = controller;
    setIsLoadingFeeds(true);
    setFeedRateLimited(false);

    // Preserve reading position when refreshing while scrolled down on Home;
    // at the top (including initial load & pull-to-refresh) update immediately.
    if (activeTab === 'home' && window.scrollY > 240 && latestHomeStories.current.length > 0) {
      setReaderFeedSnapshot(previous => previous ?? latestHomeStories.current);
    } else {
      setReaderFeedSnapshot(null);
    }

    let anySuccess = false;

    const applyArticles = (articles: NewsArticle[]) => {
      if (controller.signal.aborted || !articles.length) return;
      const now = Date.now();
      setFeedClock(now);
      checkForAlert(articles);
      setCachedLiveArticles(previous => controller.signal.aborted
        ? previous
        : mergeFeedArticles(previous, articles, latestRetention.current, now));
      setSavedArticles(previous => {
        if (controller.signal.aborted) return previous;
        const current = Object.values(previous);
        const hydrated = hydrateArticles(current, articles);
        return hydrated === current
          ? previous
          : Object.fromEntries(hydrated.map(article => [article.id, article]));
      });
      setReadArticles(previous => controller.signal.aborted ? previous : hydrateArticles(previous, articles));
    };

    const recordResults = (results: FeedResult[]) => {
      if (controller.signal.aborted || !results.length) return;
      if (results.some(result => !result.ok)) {
        recordDiagnostic('feed-failed');
      }
      const checkedAt = Date.now();
      setFeedHealth(previous => {
        const next = { ...previous };
        for (const result of results) {
          const source = activeSources.find(item => item.id === result.sourceId);
          if (!source) continue;
          const last = previous[source.id]?.url === source.url ? previous[source.id] : undefined;
          next[source.id] = {
            url: source.url, checkedAt, ok: result.ok, count: result.count,
            lastSuccess: result.ok ? checkedAt : last?.lastSuccess,
            consecutiveFailures: result.ok ? 0 : (last?.consecutiveFailures ?? 0) + 1,
          };
        }
        return next;
      });
    };

    const fetchBatch = async (batch: NewsSource[], rateLimitedRef: { current: boolean }) => {
      if (controller.signal.aborted || rateLimitedRef.current) return;
      const resp = await fetch('/api/feeds/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds: batch, force }),
        signal: controller.signal,
      });
      if (resp.status === 429) {
        rateLimitedRef.current = true;
        if (!controller.signal.aborted) setFeedRateLimited(true);
        return;
      }
      if (resp.ok) {
        anySuccess = true;
        const data = await resp.json();
        if (Array.isArray(data.articles)) applyArticles(data.articles);
        if (Array.isArray(data.feedStatuses)) recordResults(data.feedStatuses);
      }
    };

    try {
      if (Capacitor.isNativePlatform()) {
        const { fetchNativeFeeds } = await import('./lib/nativeFeed');
        await fetchNativeFeeds(activeSources, applyArticles, controller.signal, undefined, result => recordResults([result]));
        anySuccess = true;
      } else {
        const batches = planFeedBatches(activeSources);
        const rateLimitedRef = { current: false };
        if (batches.length > 0 && !controller.signal.aborted) {
          // Prioritize first batch for fastest initial paint
          await fetchBatch(batches[0], rateLimitedRef);
        }
        if (batches.length > 1 && !controller.signal.aborted && !rateLimitedRef.current) {
          await runWithConcurrency(batches.slice(1), 2, batch => fetchBatch(batch, rateLimitedRef));
        }
      }
      if (anySuccess && !controller.signal.aborted) {
        setLastUpdatedAt(Date.now());
      }
    } catch {
      // Keep the last successful results when the connection drops.
    } finally {
      if (refresh.current === controller) {
        refresh.current = null;
        feedHasLoaded.current = true;
        setIsLoadingFeeds(false);
      }
    }
  }, [activeSources, activeTab, cachedStorageReady, checkForAlert, setCachedLiveArticles, setFeedHealth, setReadArticles, setSavedArticles]);

  const fetchLatest = useRef(fetchLiveFeeds);
  useEffect(() => { fetchLatest.current = fetchLiveFeeds; }, [fetchLiveFeeds]);
  const activeSourceKey = useMemo(
    () => activeSources.map(source => source.id).sort().join(','),
    [activeSources],
  );
  const previousActiveSourceKey = useRef<string>('');
  useEffect(() => {
    if (!cachedStorageReady) return;
    if (!activeSourceKey) {
      previousActiveSourceKey.current = '';
      return;
    }
    const prevIds = new Set(previousActiveSourceKey.current ? previousActiveSourceKey.current.split(',') : []);
    const hasNewSource = activeSources.some(source => !prevIds.has(source.id));
    previousActiveSourceKey.current = activeSourceKey;
    if (hasNewSource) {
      void fetchLatest.current();
    }
  }, [cachedStorageReady, activeSourceKey, activeSources]);
  useEffect(() => () => {
    refresh.current?.abort();
    refresh.current = null;
    setIsLoadingFeeds(false);
  }, []);

  const activeArticles = useMemo(() => {
    const activeIds = new Set(activeSources.map(source => source.id));
    const pruned = pruneFeedArticles(cachedLiveArticles, retention, feedClock)
      .filter(article => activeIds.has(article.sourceId));
    return filterMutedArticles(pruned, activeMutedRules, feedClock);
  }, [activeSources, cachedLiveArticles, feedClock, retention, activeMutedRules]);

  const [mediaOrder, setMediaOrder] = useState<string[]>([]);
  useEffect(() => {
    if (activeTab !== 'media') {
      setMediaOrder(previous => previous.length ? [] : previous);
      return;
    }
    const ranked = rankArticlesForYou(activeArticles, normalizedProfile, activeSources, feedClock)
      .map(({ article }) => article.id);
    setMediaOrder(previous => {
      const available = new Set(ranked);
      const existing = new Set(previous);
      const next = previous.filter(id => available.has(id)).concat(ranked.filter(id => !existing.has(id)));
      return next.length === previous.length && next.every((id, index) => id === previous[index]) ? previous : next;
    });
  }, [activeTab, activeArticles, activeSources, normalizedProfile, feedClock]);
  const mediaArticles = useMemo(() => {
    const byId = new Map(activeArticles.map(article => [article.id, article]));
    return mediaOrder.flatMap(id => byId.get(id) ?? []);
  }, [activeArticles, mediaOrder]);

  const allArticles = useMemo(() => distinctArticles(activeArticles), [activeArticles]);

  const homeSections = useMemo(
    () => {
      const topicWeights = { ...normalizedProfile.topicWeights };
      for (const topic of preferences.topics) topicWeights[topic] = (topicWeights[topic] ?? 0) + 4;
      return buildHomeSections(activeArticles, { ...normalizedProfile, topicWeights }, sources, feedClock);
    },
    [activeArticles, normalizedProfile, sources, preferences.topics, feedClock]
  );

  const perspectiveArticles = useMemo(() => {
    if (!activeArticle) return [];
    const pools = [homeSections.Heute, homeSections.Neueste, homeSections['Für dich']];
    for (const pool of pools) {
      const existing = pool.find(story => story.reports.some(report => report.id === activeArticle.id));
      if (existing) {
        return [...new Map(existing.reports.map(report => [report.sourceId, report])).values()].slice(0, 6);
      }
    }
    const cluster = clusterStories(activeArticles)
      .find(story => story.reports.some(report => report.id === activeArticle.id));
    if (!cluster) return [];
    return [...new Map(cluster.reports.map(report => [report.sourceId, report])).values()].slice(0, 6);
  }, [activeArticle, activeArticles, homeSections]);
  const todayLeadArticles = useMemo(
    () => homeSections.Heute.slice(0, 14).flatMap(story => story.reports),
    [homeSections.Heute]
  );
  useLayoutEffect(() => {
    latestHomeStories.current = homeSections[homeCategory];
  }, [homeSections, homeCategory]);
  const pendingNewCount = useMemo(() => {
    if (!readerFeedSnapshot || activeTab !== 'home') return 0;
    const shownIds = new Set(readerFeedSnapshot.map(story => story.lead.id));
    return homeSections[homeCategory].filter(story => !shownIds.has(story.lead.id)).length;
  }, [readerFeedSnapshot, activeTab, homeSections, homeCategory]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !briefingSettings.enabled) return;
    const headline = homeSections.Heute[0]?.lead.title;
    if (headline) {
      void import('./lib/dailyBriefing')
        .then(({ DailyBriefing }) => DailyBriefing.updateHeadline({ headline: headline.slice(0, 240) }))
        .catch(() => {});
    }
  }, [homeSections, briefingSettings.enabled]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !onboarded) return;
    let active = true;
    let dispose: (() => void) | undefined;
    const show = () => {
      if (!active) return;
      const destination = { ...HOME_LOCATION, briefing: true };
      window.history.replaceState(null, '');
      window.history.pushState({ openNews: destination }, '');
      setHomeCategory('Heute');
      setLocation(destination);
    };
    void import('./lib/dailyBriefing').then(async ({ DailyBriefing }) => {
      if (!active) return;
      const handle = await DailyBriefing.addListener('open', show);
      if (!active) {
        await handle.remove();
        return;
      }
      dispose = () => { void handle.remove(); };
      const result = await DailyBriefing.getLaunch();
      if (result.open) show();
    }).catch(() => {});
    return () => {
      active = false;
      dispose?.();
    };
  }, [onboarded]);

  // Prefetch ArticleReaderModal chunk on idle so the first article tap opens instantaneously
  useEffect(() => {
    if (!onboarded) return;
    const timer = window.setTimeout(() => {
      void import('./components/ArticleReaderModal').catch(() => {});
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [onboarded]);

  // Gentle, data-saving background offline preloading (strict session budget of 3 text articles)
  useEffect(() => {
    if (!onboarded || !cachedStorageReady || isLoadingFeeds || !homeSections.Heute.length) return;
    const controller = new AbortController();
    let idleId: number | undefined;
    const startPreload = () => {
      const allowedFullText = new Set(preferences.fullTextSourceIds ?? []);
      if (allowedFullText.size === 0) return;
      const todayLeads = homeSections.Heute.slice(0, 4).map(story => story.lead).filter(a => allowedFullText.has(a.sourceId));
      const prioritySaved = distinctArticles([
        ...readingQueueIds.map(id => savedArticles[id]).filter((a): a is NewsArticle => Boolean(a)),
        ...Object.values(savedArticles).slice(0, 3),
      ]).filter(a => allowedFullText.has(a.sourceId));
      if (!todayLeads.length && !prioritySaved.length) return;
      void import('./lib/offlinePreload')
        .then(({ runIntelligentOfflinePreload }) =>
          runIntelligentOfflinePreload(todayLeads, prioritySaved, {
            maxCount: 3,
            signal: controller.signal,
          }),
        )
        .catch(() => {});
    };
    const timer = window.setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof ric === 'function') {
        idleId = ric(startPreload, { timeout: 3000 });
      } else {
        startPreload();
      }
    }, 4200);
    return () => {
      window.clearTimeout(timer);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idleId !== undefined && typeof cic === 'function') cic(idleId);
      controller.abort();
    };
  }, [onboarded, cachedStorageReady, isLoadingFeeds, homeSections.Heute, readingQueueIds, savedArticles]);

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (!cachedStorageReady || isLoadingFeeds || (platform !== 'android' && platform !== 'ios')) return;
    const bookmarkedSet = new Set(normalizedProfile.bookmarkedIds);
    const snapshot = (tab: HomeTab) => homeSections[tab].slice(0, platform === 'ios' ? 3 : 24).map(({ lead }) => ({
      ...lead, contentHtml: undefined, paragraphs: [], summary: lead.summary.slice(0, 400),
      ...(platform === 'android' && { widgetSaved: bookmarkedSet.has(lead.id) }),
    }));
    const feeds = platform === 'android'
      ? activeSources
        .filter(source => source.format !== 'podcast')
        .slice(0, 25)
        .map(source => ({
          id: source.id,
          name: source.name,
          url: source.url,
          category: source.category,
          accentColor: source.accentColor,
          shortCode: source.shortCode,
        }))
      : undefined;
    const mutedList = platform === 'android'
      ? activeMutedRules.map(rule => rule.keyword)
      : undefined;
    void import('./lib/newsWidget').then(({ NewsWidget }) => NewsWidget.update({
      today: snapshot('Heute'), personal: snapshot('Für dich'), latest: snapshot('Neueste'),
      ...(platform === 'android' && { language: activeLanguage, theme, feeds, mutedKeywords: mutedList }),
    })).catch(() => {});
  }, [activeLanguage, activeMutedRules, activeSources, cachedStorageReady, homeSections, isLoadingFeeds, normalizedProfile.bookmarkedIds, theme]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !cachedStorageReady) return;
    const timer = window.setTimeout(() => {
      void import('./lib/androidAuto').then(({ buildAndroidAutoPayload, syncAndroidAuto }) =>
        syncAndroidAuto(
          buildAndroidAutoPayload({
            settings: androidAutoSettings,
            language: activeLanguage,
            sources,
            articles: allArticles,
            radioFavorites,
            audioPositions,
          }),
        ),
      ).catch(() => {});
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeLanguage, allArticles, androidAutoSettings, audioPositions, cachedStorageReady, radioFavorites, sources]);

  const openSettings = (sec: SettingsSectionTab = 'overview') => {
    navigate({ tab: 'settings', settings: sec });
  };

  const handleOpenArticle = (article: NewsArticle, contextList?: readonly NewsArticle[]) => {
    if (activeTab === 'home') {
      setReaderFeedSnapshot(previous => previous ?? homeSections[homeCategory]);
    }
    if (contextList && contextList.length > 0) {
      setReaderContextList([...contextList]);
    } else {
      setReaderContextList(previous => (
        previous.some(item => item.id === article.id)
          ? previous
          : homeSections[homeCategory].map(story => story.lead)
      ));
    }
    navigate({ article });
    const historyEntry = {
      ...article,
      contentHtml: undefined,
      summary: article.summary.slice(0, 800),
      paragraphs: article.paragraphs.slice(0, 4).map(paragraph => paragraph.slice(0, 450)),
    };
    setReadArticles(previous => [historyEntry, ...previous.filter(item => articleIdentity(item) !== articleIdentity(article))].slice(0, 60));
    setProfile((prev) => recordArticleRead(normalizeProfile(prev), article));
  };

  const handleSaveReadingProgress = useCallback((articleId: string, ratio: number) => {
    setReadingProgress(prev => upsertReadingProgress(prev, articleId, ratio));
  }, [setReadingProgress]);

  const handleWidgetLaunch = useRef<(event: WidgetLaunch) => void>(() => {});
  useLayoutEffect(() => {
    handleWidgetLaunch.current = ({ article, refresh, discover, save, section }) => {
      const tab = section === 'today' ? 'Heute' : section === 'personal' ? 'Für dich' : section === 'latest' ? 'Neueste' : null;
      if (tab) {
        setHomeCategory(tab);
        navigate({ tab: 'home' });
      }
      if (discover) navigate({ tab: 'discover' });
      if (article) {
        if (typeof save === 'boolean') {
          const isSaved = normalizedProfile.bookmarkedIds.includes(article.id);
          if (save !== isSaved) handleToggleBookmark(article);
        }
        handleOpenArticle(article);
      }
      if (refresh) void fetchLatest.current();
    };
  });
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (!onboarded || (platform !== 'android' && platform !== 'ios')) return;
    let active = true;
    let dispose: (() => void) | undefined;
    const handle = (event: WidgetLaunch) => { if (active) handleWidgetLaunch.current(event); };
    void import('./lib/newsWidget').then(async ({ NewsWidget }) => {
      if (!active) return;
      const listener = await NewsWidget.addListener('openStory', handle);
      if (!active) {
        await listener.remove();
        return;
      }
      dispose = () => { void listener.remove(); };
      if (platform === 'android') handle(await NewsWidget.getLaunchArticle());
    }).catch(() => {});
    return () => { active = false; dispose?.(); };
  }, [onboarded]);

  const handleNotificationLaunch = useRef<(event: {
    article?: Partial<NewsArticle>;
    pendingSaves?: Array<Partial<NewsArticle>>;
  }) => void>(() => {});
  useEffect(() => {
    handleNotificationLaunch.current = ({ article, pendingSaves }) => {
      if (pendingSaves?.length) {
        for (const savedItem of pendingSaves) {
          if (!savedItem.id || !savedItem.title || !savedItem.link) continue;
          const fullArticle: NewsArticle = {
            id: savedItem.id,
            sourceId: savedItem.sourceId ?? 'push',
            sourceName: savedItem.sourceName ?? 'OpenNews',
            sourceShortCode: savedItem.sourceShortCode ?? 'ON',
            sourceColor: savedItem.sourceColor ?? '#23262e',
            title: savedItem.title,
            summary: savedItem.summary ?? '',
            paragraphs: savedItem.paragraphs ?? (savedItem.summary ? [savedItem.summary] : []),
            link: savedItem.link,
            imageUrl: savedItem.imageUrl,
            category: savedItem.category ?? 'Politik',
            publishedAt: savedItem.publishedAt ?? new Date().toISOString(),
            readingTimeMin: savedItem.readingTimeMin ?? 2,
            keywords: savedItem.keywords ?? [],
          };
          if (!normalizedProfile.bookmarkedIds.includes(fullArticle.id)) {
            handleToggleBookmark(fullArticle);
          }
        }
      }
      if (article?.title && (article.link || article.id)) {
        const matched = allArticles.find(a => a.id === article.id || (article.link && a.link === article.link));
        if (matched) {
          handleOpenArticle(matched);
        } else if (article.id && article.link) {
          handleOpenArticle({
            id: article.id,
            sourceId: article.sourceId ?? 'push',
            sourceName: article.sourceName ?? 'OpenNews',
            sourceShortCode: article.sourceShortCode ?? 'ON',
            sourceColor: article.sourceColor ?? '#23262e',
            title: article.title,
            summary: article.summary ?? '',
            paragraphs: article.summary ? [article.summary] : [],
            link: article.link,
            imageUrl: article.imageUrl,
            category: article.category ?? 'Politik',
            publishedAt: article.publishedAt ?? new Date().toISOString(),
            readingTimeMin: 2,
            keywords: [],
            isBreaking: article.isBreaking,
          });
        }
      }
    };
  });

  useEffect(() => {
    if (!onboarded || Capacitor.getPlatform() !== 'android') return;
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./lib/newsPush').then(async ({ NewsPush }) => {
      if (!active) return;
      const listener = await NewsPush.addListener('openNotification', (ev) => {
        if (active) handleNotificationLaunch.current(ev);
      });
      if (!active) {
        await listener.remove();
        return;
      }
      dispose = () => { void listener.remove(); };
      const initial = await NewsPush.getLaunchNotification();
      if (active) handleNotificationLaunch.current(initial);
    }).catch(() => {});
    return () => { active = false; dispose?.(); };
  }, [onboarded]);

  const handleToggleBookmark = useCallback((article: NewsArticle) => {
    setSavedArticles(previous => (previous[article.id] ? previous : { ...previous, [article.id]: article }));
    setProfile((prev) => toggleArticleBookmark(normalizeProfile(prev), article));
  }, [setProfile, setSavedArticles]);

  const handleToggleLike = useCallback((article: NewsArticle) => {
    setSavedArticles(previous => (previous[article.id] ? previous : { ...previous, [article.id]: article }));
    setProfile((prev) => toggleArticleLike(normalizeProfile(prev), article));
  }, [setProfile, setSavedArticles]);

  const handleToggleDislike = useCallback((article: NewsArticle) => {
    setProfile((prev) => toggleArticleDislike(normalizeProfile(prev), article));
    goBack();
  }, [setProfile, goBack]);

  const [undoDismiss, setUndoDismiss] = useState<{
    article: NewsArticle;
    previousProfile: PersonalizationProfile;
  } | null>(null);
  const undoTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), []);

  const handleDismissLessLikeThis = useCallback((article: NewsArticle) => {
    window.clearTimeout(undoTimerRef.current);
    const snapshot = normalizeProfile(profile);
    setProfile(prev => dismissArticleLessLikeThis(normalizeProfile(prev), article));
    setReaderFeedSnapshot(prev => (prev ? prev.filter(story => story.lead.id !== article.id) : prev));
    setUndoDismiss({ article, previousProfile: snapshot });
    undoTimerRef.current = window.setTimeout(() => setUndoDismiss(null), 5200);
  }, [profile, setProfile]);

  const handleUndoDismiss = useCallback(() => {
    if (!undoDismiss) return;
    window.clearTimeout(undoTimerRef.current);
    const restored = undoDismiss.previousProfile;
    setProfile(restored);
    setReaderFeedSnapshot(null);
    setUndoDismiss(null);
  }, [undoDismiss, setProfile]);

  const handleToggleQueue = useCallback((article: NewsArticle) => {
    setSavedArticles(saved => (saved[article.id] ? saved : { ...saved, [article.id]: article }));
    setReadingQueueIds(prev => (prev.includes(article.id) ? prev.filter(id => id !== article.id) : [...prev, article.id]));
  }, [setReadingQueueIds, setSavedArticles]);

  const handleAddHighlight = (article: NewsArticle, quote: string) => {
    const trimmed = quote.trim();
    if (trimmed.length < 8) return;
    setHighlights(prev => {
      if (prev.some(item => item.articleId === article.id && item.quote === trimmed)) return prev;
      const entry: ArticleHighlight = {
        id: `${article.id}-${Date.now()}`,
        articleId: article.id,
        articleTitle: article.title,
        articleLink: article.link,
        sourceName: article.sourceName,
        quote: trimmed,
        createdAt: new Date().toISOString(),
      };
      return [entry, ...prev].slice(0, 120);
    });
  };

  const handleAddMuteKeyword = (keyword: string, duration: MuteDuration) => {
    const rule = createMuteRule(keyword, duration);
    if (!rule) return;
    setMutedKeywords(prev => {
      const cleaned = pruneExpiredMutes(prev);
      if (cleaned.some(item => item.keyword.toLowerCase() === rule.keyword.toLowerCase())) return cleaned;
      return [rule, ...cleaned];
    });
  };

  const handleRemoveMuteKeyword = (id: string) => {
    setMutedKeywords(prev => prev.filter(item => item.id !== id));
  };

  const handleAddTrackedKeyword = (keyword: string) => {
    const cleaned = keyword.trim();
    if (cleaned.length < 2) return;
    setTrackedKeywords(prev => (prev.some(k => k.toLowerCase() === cleaned.toLowerCase()) ? prev : [cleaned, ...prev].slice(0, 15)));
  };

  const handleRemoveTrackedKeyword = (keyword: string) => {
    setTrackedKeywords(prev => prev.filter(k => k !== keyword));
  };

  const handlePlayPersistentAudio = (
    article: NewsArticle,
    media: PlayableMedia,
    queue?: ActiveAudioTrack[],
  ) => {
    if (activeAudio?.media.url !== media.url) {
      setBriefingStopSignal(n => n + 1);
    }
    setActiveAudio(current => {
      if (current?.media.url === media.url) {
        setAudioQueue([]);
        return null;
      }
      setAudioQueue(queue ?? []);
      return { article, media };
    });
  };

  const handlePlayRadioStation = useCallback((track: ActiveAudioTrack) => {
    if (activeAudio?.media.url !== track.media.url) {
      setBriefingStopSignal(n => n + 1);
    }
    setActiveAudio(current => {
      if (current?.media.url === track.media.url) {
        setAudioQueue([]);
        return null;
      }
      setAudioQueue([]);
      return track;
    });
  }, [activeAudio?.media.url]);

  const handleToggleRadioFavorite = useCallback((stationId: string) => {
    setRadioFavorites(prev => (
      prev.includes(stationId) ? prev.filter(id => id !== stationId) : [stationId, ...prev]
    ));
  }, [setRadioFavorites]);

  const handleNextAudioTrack = useCallback(() => {
    setAudioQueue(previous => {
      if (previous.length === 0) return previous;
      const [next, ...rest] = previous;
      setActiveAudio(next);
      return rest;
    });
  }, []);

  const handleSaveAudioPosition = useCallback((url: string, seconds: number, duration: number) => {
    setAudioPositions(prev => upsertAudioPosition(prev, url, seconds, duration));
  }, [setAudioPositions]);

  const queueArticles = useMemo(() => {
    const byId = new Map<string, NewsArticle>();
    for (const a of allArticles) byId.set(a.id, a);
    for (const a of Object.values(savedArticles)) byId.set(a.id, a);
    return readingQueueIds.map(id => byId.get(id)).filter((a): a is NewsArticle => Boolean(a));
  }, [readingQueueIds, allArticles, savedArticles]);

  const nextQueuedArticle = useMemo(() => {
    if (!activeArticle || !queueArticles.length) return undefined;
    const idx = queueArticles.findIndex(a => a.id === activeArticle.id);
    if (idx >= 0) return queueArticles[idx + 1];
    return queueArticles[0];
  }, [activeArticle, queueArticles]);

  const readerNeighbors = useMemo(
    () => (activeArticle ? resolveNeighborArticles(activeArticle.id, readerContextList) : { index: -1, total: 0 }),
    [activeArticle, readerContextList],
  );

  const handleRecordReadingDuration = useCallback(
    (article: NewsArticle, seconds: number) => {
      setProfile((prev) => recordReadingDuration(normalizeProfile(prev), article, seconds));
    },
    [setProfile]
  );

  const handleUpdateSource = (sourceId: string, updates: Partial<NewsSource>) => {
    setSources(() => sources.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)));
  };

  const handleToggleSubscribe = (sourceId: string) => {
    const source = sources.find(item => item.id === sourceId);
    if (source?.format === 'podcast' && !source.subscribed) {
      setFormatPrefs(previous => previous.podcasts ? previous : { ...previous, podcasts: true });
    }
    setSources(() =>
      sources.map((s) => (s.id === sourceId ? { ...s, subscribed: !s.subscribed } : s))
    );
    if (source && !source.subscribed) {
      setFeedHealth(previous => {
        if (!previous[sourceId]) return previous;
        const next = { ...previous };
        delete next[sourceId];
        return next;
      });
    }
  };

  const handleSetSourceSubscriptions = (ids: readonly string[], subscribed: boolean) => {
    const targetIds = new Set(ids);
    if (!targetIds.size) return;
    if (subscribed && sources.some(item => targetIds.has(item.id) && item.format === 'podcast')) {
      setFormatPrefs(previous => previous.podcasts ? previous : { ...previous, podcasts: true });
    }
    setSources(() =>
      sources.map(item => targetIds.has(item.id) ? { ...item, subscribed } : item)
    );
    if (subscribed) {
      setFeedHealth(previous => {
        let changed = false;
        const next = { ...previous };
        for (const id of targetIds) {
          if (next[id]) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    }
  };

  const handleNotificationSettings = async (next: NotificationSettings) => {
    if (Capacitor.getPlatform() === 'android' && next.enabled && !notifications.enabled) {
      setRequestingPushPermission(true);
      setPushStatus('');
      try {
        const { NewsPush } = await import('./lib/newsPush');
        const { allowed } = await NewsPush.requestAccess();
        setPushPermissionDenied(!allowed);
        if (!allowed) {
          setPushStatus('Erlaube Benachrichtigungen in den Android-Einstellungen.');
          return;
        }
      } catch {
        setPushStatus('Die Android-Freigabe konnte nicht abgefragt werden.');
        return;
      } finally {
        setRequestingPushPermission(false);
      }
    } else if (
      Capacitor.getPlatform() !== 'android'
      && next.enabled
      && !notifications.enabled
      && 'Notification' in window
      && Notification.permission === 'default'
    ) {
      setRequestingPushPermission(true);
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'denied') {
          setPushStatus('Browser-Benachrichtigungen wurden blockiert — In-App-Hinweise bleiben aktiv.');
        } else if (perm === 'granted') {
          setPushStatus('Browser-Benachrichtigungen sind aktiviert.');
        }
      } catch {
        // Ignore restricted Notification.requestPermission contexts
      } finally {
        setRequestingPushPermission(false);
      }
    }
    if (!next.enabled) {
      pushSyncVersion.current++;
      setPushPermissionDenied(false);
      setPushStatus('');
    }
    setNotifications(next);
  };

  const handleSendTestNotification = () => {
    if (Capacitor.getPlatform() === 'android') {
      void import('./lib/newsPush')
        .then(({ NewsPush }) => NewsPush.test())
        .catch(() => showAlert('Android hat Benachrichtigungen gesperrt.', 'OpenNews · Test'));
    } else {
      showAlert('Benachrichtigungen sind aktiv.', 'OpenNews · Test');
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('OpenNews · Test', { body: 'Browser-Benachrichtigungen sind aktiv.', tag: 'opennews-test' });
        } catch {
          // Ignore Notification constructor errors in headless environments
        }
      }
    }
  };

  const [backupStatus, setBackupStatus] = useState('');
  const exportBackup = async () => {
    const { createDeviceBackup } = await import('./lib/deviceBackup');
    const backup = createDeviceBackup(sources, normalizedProfile, savedArticles);
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = 'opennews-sicherung.json';
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('Datei zu groß');
      const { parseDeviceBackup } = await import('./lib/deviceBackup');
      const backup = parseDeviceBackup(await file.text());
      setSources(previous => {
        const incoming = new Map(backup.sources.map(source => [source.url, source]));
        const merged = previous.map(source => incoming.delete(source.url) ? { ...source, subscribed: true } : source);
        return [...merged, ...incoming.values()];
      });
      setProfile(previous => {
        const bookmarks = [...new Set([...previous.bookmarkedIds, ...backup.reactions.bookmarkedIds])];
        const disliked = [...new Set([...previous.dislikedIds, ...backup.reactions.dislikedIds])];
        const liked = [...new Set([...previous.likedIds, ...backup.reactions.likedIds])].filter(id => !disliked.includes(id));
        return { ...previous, bookmarkedIds: bookmarks, dislikedIds: disliked, likedIds: liked };
      });
      setSavedArticles(previous => ({ ...Object.fromEntries(backup.bookmarks.map(article => [article.id, article])), ...previous }));
      setBackupStatus('Sicherung übernommen.');
    } catch {
      setBackupStatus('Sicherung konnte nicht gelesen werden. Wähle eine OpenNews-Sicherung bis 5 MB.');
    }
  };

  const openProfile = (page: ProfilePage = 'profile') => {
    navigate({ tab: 'profile', profile: page });
  };
  const openSaved = (page: 'bookmarks' | 'history') => {
    navigate({ tab: 'saved', saved: page });
  };

  const reducedMotion = preferences.motion === 'reduced' || osReducedMotion;
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  const handleApplyPending = () => {
    setReaderFeedSnapshot(null);
    scrollToTop();
  };

  const navItems = [
    {
      id: 'home',
      label: t('navHome'),
      shortLabel: t('navHome'),
      icon: Home,
      action: () => (activeTab === 'home' ? scrollToTop() : navigate({ tab: 'home' })),
    },
    {
      id: 'discover',
      label: t('navDiscover'),
      shortLabel: t('navDiscover'),
      icon: Compass,
      action: () => (activeTab === 'discover' ? scrollToTop() : navigate({ tab: 'discover' })),
    },
    {
      id: 'media',
      label: t('navMedia'),
      shortLabel: t('navMediaShort'),
      icon: Clapperboard,
      action: () => (activeTab === 'media' ? scrollToTop() : navigate({ tab: 'media' })),
    },
    {
      id: 'profile',
      label: t('navProfile'),
      shortLabel: t('navProfile'),
      icon: User,
      action: () => (activeTab === 'profile' && profilePage === 'profile' ? scrollToTop() : openProfile()),
    },
  ] as const;
  const navIsActive = (id: string) => activeTab === id || (id === 'profile' && ['settings', 'saved'].includes(activeTab));
  const appearance = { theme, onTheme: setTheme, preferences, onPreferences: updatePreferences };
  const profileStats = useMemo(() => ({
    sources: activeSources.length,
    saved: Object.keys(savedArticles).length,
    read: readArticles.length,
  }), [activeSources.length, savedArticles, readArticles.length]);

  const hasFloatingPlayer = Boolean(activeAudio) || (briefingActive && !location.briefing && !activeArticle);

  return (
    <I18nProvider lang={activeLanguage}>
    <div className={`opennews-canvas ${hasFloatingPlayer ? 'has-mini-player' : ''}`} data-glass={preferences.glass} data-accent={preferences.accent}
      data-corners={preferences.corners} data-cards={preferences.cards} data-scale={preferences.textScale}
      data-feed-images={preferences.images} data-nav-hidden={navigationHidden || undefined}>
      {!onboarded ? <Suspense fallback={<ViewStatus title={t('loadingView')} />}><Onboarding
        {...appearance}
        sources={sources}
        onToggleSource={handleToggleSubscribe}
        onSetSourceSubscriptions={handleSetSourceSubscriptions}
        onFinish={() => setOnboarded(true)}
        onConfigure={() => {
          setOnboarded(true);
          openProfile('preferences');
        }}
      /></Suspense> : <>
      <OfflineIndicator />

      {/* In-App Breaking Notification Banner */}
      {alertBanner && (
          <div
            key={alertBanner.title}
            role="status"
            className="motion-banner-in liquid-glass-dock fixed left-1/2 z-[60] flex w-[92%] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl p-3.5 shadow-xl"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)]">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[var(--accent)]">{alertBanner.source}</p>
              <p className="truncate text-xs font-semibold text-[var(--ink)]">
                {alertBanner.title}
              </p>
            </div>
          </div>
      )}

      <header className="app-header hidden md:block" inert={activeArticle ? true : undefined}>
        <div className="app-header-inner">
          <button type="button" className="brand" onClick={() => (activeTab === 'home' ? scrollToTop() : navigate({ tab: 'home' }))}>
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" /> OpenNews
          </button>
          <nav aria-label={t('navMainAria')} className="hidden items-center gap-1.5 md:flex">
            {navItems.map(item => {
              const active = navIsActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="desktop-nav-link"
                  onClick={item.action}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                  {active && <span className="desktop-nav-underline" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="app-content" inert={activeArticle ? true : undefined}>
        {(cachedStorageFailed || savedStorageFailed || historyStorageFailed) && (
          <p className="px-5 py-3 text-sm" role="status">
            {t('storageFailedBanner')}
          </p>
        )}
        {feedRateLimited && (
          <p className="settings-group mb-4 px-4 py-3 text-sm" role="status">
            {t('rateLimitBanner')}
          </p>
        )}
        {activeTab === 'home' && (
          <HomeView
            stories={readerFeedSnapshot ?? homeSections[homeCategory]}
            hasActiveSources={activeSources.length > 0}
            onOpenBriefing={() => navigate({ briefing: true })}
            briefingPlaying={briefingActive}
            showHero={preferences.hero}
            selectedCategory={homeCategory}
            onSelectCategory={setHomeCategory}
            profile={normalizedProfile}
            readingQueueIds={readingQueueIds}
            readingProgress={readingProgress}
            isLoading={isLoadingFeeds}
            lastUpdatedAt={lastUpdatedAt}
            pendingNewCount={pendingNewCount}
            onApplyPending={handleApplyPending}
            onRefresh={fetchLiveFeeds}
            onOpenSources={() => openSettings('feeds')}
            onOpenDiscover={() => navigate({ tab: 'discover' })}
            onApplyStarterPack={sourceIds => handleSetSourceSubscriptions(sourceIds, true)}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleQueue={handleToggleQueue}
            onDismissLessLikeThis={handleDismissLessLikeThis}
          />
        )}

        <ErrorBoundary inline resetKey={activeTab}>
        <Suspense fallback={<ViewStatus title={t('loadingView')} />}>
        {activeTab === 'discover' && (
          <DiscoverView
            articles={allArticles}
            sources={sources}
            profile={normalizedProfile}
            readingQueueIds={readingQueueIds}
            readingProgress={readingProgress}
            mutedKeywords={activeMutedRules}
            trackedKeywords={trackedKeywords}
            onAddMuteKeyword={handleAddMuteKeyword}
            onRemoveMuteKeyword={handleRemoveMuteKeyword}
            onAddTrackedKeyword={handleAddTrackedKeyword}
            onRemoveTrackedKeyword={handleRemoveTrackedKeyword}
            onToggleSubscribe={handleToggleSubscribe}
            onApplyStarterPack={ids => handleSetSourceSubscriptions(ids, true)}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleQueue={handleToggleQueue}
            onOpenSourcesSettings={() => openSettings('feeds')}
          />
        )}

        {activeTab === 'saved' && (
          <SavedView
            aiConfig={aiConfig}
            key={savedPage}
            initialPage={savedPage}
            history={distinctArticles([...readArticles, ...allArticles.filter(article => normalizedProfile.readIds.includes(article.id))])}
            articles={Object.values(savedArticles)}
            queueArticles={queueArticles}
            readingQueueIds={readingQueueIds}
            readingProgress={readingProgress}
            highlights={highlights}
            sources={sources}
            profile={normalizedProfile}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleQueue={handleToggleQueue}
            onRemoveFromQueue={id => setReadingQueueIds(prev => prev.filter(item => item !== id))}
            onRemoveHighlight={id => setHighlights(prev => prev.filter(item => item.id !== id))}
            onClearHistory={async () => {
              const { clearAIResults } = await import('./lib/aiCache');
              await clearAIResults();
              setReadArticles([]);
              setProfile(previous => ({ ...normalizeProfile(previous), readIds: [] }));
            }}
            onBack={goBack}
          />
        )}

        {activeTab === 'media' && (
          <MediaView
            aiConfig={aiConfig}
            articles={mediaArticles}
            sources={sources}
            hasActiveSources={activeSources.length > 0}
            loading={isLoadingFeeds}
            background={backgroundPlayback}
            activeAudioUrl={activeAudio?.media.url}
            audioPositions={audioPositions}
            radioFavorites={radioFavorites}
            initialClipUrl={pendingClipUrl}
            onClearInitialClip={() => setPendingClipUrl(undefined)}
            onPlayAudio={handlePlayPersistentAudio}
            onPlayRadio={handlePlayRadioStation}
            onToggleRadioFavorite={handleToggleRadioFavorite}
            liked={normalizedProfile.likedIds}
            saved={normalizedProfile.bookmarkedIds}
            onLike={handleToggleLike}
            onSave={handleToggleBookmark}
            onToggleSubscribe={handleToggleSubscribe}
            onApplyStarterPack={ids => handleSetSourceSubscriptions(ids, true)}
            onEngaged={(article, seconds) => setProfile(previous => {
              const profile = normalizeProfile(previous);
              return profile.readIds.includes(article.id) ? profile
                : recordReadingDuration(recordArticleRead(profile, article), article, seconds);
            })}
            onArticle={handleOpenArticle}
            onSources={() => openSettings('feeds')}
          />
        )}

        {activeTab === 'profile' && <ProfileView {...appearance} page={profilePage} onPage={page => openProfile(page)} onBack={goBack}
          stats={profileStats}
          onSaved={() => openSaved('bookmarks')} onHistory={() => openSaved('history')}
          onSources={() => openSettings('feeds')} onAI={() => openSettings('ai')} onNotifications={() => openSettings('app')}
          backupControls={
            <div className="space-y-2">
              <p>{t('settingsBackupDesc')}</p>
              <div className="flex flex-wrap gap-2">
                <button className="choice-pill" type="button" onClick={exportBackup}>{t('settingsBackupExport')}</button>
                <label className="choice-pill cursor-pointer">{t('settingsBackupImport')}
                  <input type="file" accept=".json,application/json" className="sr-only" onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void importBackup(file);
                  }} />
                </label>
              </div>
              <p role="status">{backupStatus}</p>
            </div>
          }
          autoTranslate={autoTranslate} onAutoTranslate={setAutoTranslate}
          backgroundPlayback={backgroundPlayback} onBackgroundPlayback={setBackgroundPlayback}
          androidAutoSettings={androidAutoSettings}
          onAndroidAutoSettings={setAndroidAutoSettings}
          onRefreshAndroidAuto={async () => {
            const { buildAndroidAutoPayload, refreshAndroidAutoNow, syncAndroidAuto } = await import('./lib/androidAuto');
            await syncAndroidAuto(
              buildAndroidAutoPayload({
                settings: androidAutoSettings,
                language: activeLanguage,
                sources,
                articles: allArticles,
                radioFavorites,
                audioPositions,
              }),
            );
            return refreshAndroidAutoNow();
          }}
          fontSize={fontSize} fontFamily={fontFamily} onFontSize={setFontSize} onFontFamily={setFontFamily}
          readerTheme={readerTheme} onReaderTheme={setReaderTheme}
          newspaperMode={newspaperMode} onNewspaperMode={setNewspaperMode} />}

        {activeTab === 'settings' && (
          <SettingsView
            key={settingsSection}
            feedHealth={feedHealth}
            initialSection={settingsSection}
            sources={sources}
            formatPrefs={formatPrefs}
            aiConfig={aiConfig}
            ttsConfig={ttsConfig}
            notifications={notifications}
            briefingSettings={briefingSettings}
            onBriefingSettings={setBriefingSettings}
            onAdvancedSources={() => openSettings('overview')}
            onImportSources={imported => {
              const normalized = (url: string) => { try { return new URL(url).href; } catch { return url; } };
              const incoming = new Map(imported.map(source => [normalized(source.url), source]));
              const merged = sources.map(source => {
                if (!incoming.delete(normalized(source.url))) return source;
                return { ...source, subscribed: true };
              });
              setSources([...merged, ...incoming.values()]);
            }}
            onToggleSource={handleToggleSubscribe}
            onSetSourceSubscriptions={handleSetSourceSubscriptions}
            onAddCustomSource={(src) => setSources((prev) => prev.some(source => source.url === src.url) ? prev : [src, ...prev])}
            onUpdateSource={handleUpdateSource}
            onRemoveCustomSource={(id) =>
              setSources((prev) => prev.filter((s) => s.id !== id))
            }
            onUpdateFormatPrefs={setFormatPrefs}
            onUpdateAIConfig={updateAIConfig}
            onUpdateTTSConfig={updateTTSConfig}
            persistWebKeys={persistWebKeys}
            onTogglePersistWebKeys={handleTogglePersistWebKeys}
            pushStatus={pushStatus}
            pushPermissionDenied={pushPermissionDenied}
            requestingPushPermission={requestingPushPermission}
            onUpdateNotifications={next => void handleNotificationSettings(next)}
            onSendTestNotification={handleSendTestNotification}
            onResetAlgorithm={() => setProfile(previous => resetProfileWeights(normalizeProfile(previous)))}
            onBackHome={goBack}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>

      <nav aria-label={t('navMobileAria')} className="mobile-navigation"
        data-scroll-hidden={navigationHidden} inert={activeArticle ? true : undefined}>
        <div className="liquid-glass-dock">
          {navItems.map(({ id, label, shortLabel, icon: Icon, action }) => {
            const active = navIsActive(id);
            return (
              <button key={id} type="button" onClick={action}
                aria-current={active ? 'page' : undefined} aria-label={label} className="dock-tab">
                {active && <span className="dock-selection" />}
                <Icon size={21} strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                <span className="dock-label" aria-hidden="true">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Persistent Daily Briefing Dialog + Cross-Tab Mini-Player */}
      {(Boolean(location.briefing) || briefingActive) && (
        <Suspense fallback={null}>
          <AudioBriefing
            articles={todayLeadArticles}
            config={aiConfig}
            ttsConfig={ttsConfig}
            open={Boolean(location.briefing)}
            stopSignal={briefingStopSignal}
            onOpen={() => navigate({ briefing: true })}
            onClose={goBack}
            onOpenArticle={handleOpenArticle}
            onBeforeSpeak={() => {
              setActiveAudio(null);
              setAudioQueue([]);
            }}
            onPlaybackChange={setBriefingActive}
          />
        </Suspense>
      )}

      {/* Persistent Mini-Audio-Player across tabs */}
      {activeAudio && (
        <Suspense fallback={null}>
          <MiniAudioPlayer
            track={activeAudio}
            initialSeconds={activeAudio.isLive ? 0 : (audioPositions[activeAudio.media.url]?.seconds ?? 0)}
            background={backgroundPlayback}
            nextTrack={audioQueue[0]}
            onNextTrack={audioQueue.length > 0 ? handleNextAudioTrack : undefined}
            onSavePosition={handleSaveAudioPosition}
            onEngaged={handleRecordReadingDuration}
            onOpenArticle={handleOpenArticle}
            onClose={() => {
              setActiveAudio(null);
              setAudioQueue([]);
            }}
          />
        </Suspense>
      )}

      {/* Floating Undo Toast after Swipe-to-Dismiss ("Weniger davon") */}
      <div className="undo-toast-anchor">
        {undoDismiss && !activeArticle && (
          <div
            key={undoDismiss.article.id}
            role="status"
            aria-live="polite"
            className="undo-toast motion-toast-in"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--ink)]">
              {t('swipeDismissedToast', {
                category: undoDismiss.article.category,
                source: undoDismiss.article.sourceName,
              })}
            </span>
            <button
              type="button"
              onClick={handleUndoDismiss}
              className="shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-ink)] transition-transform active:scale-95"
            >
              {t('undo')}
            </button>
          </div>
        )}
      </div>

      {/* Article Reader Sheet */}
      {activeArticle && (
      <ErrorBoundary inline resetKey={activeArticle.id}>
      <Suspense fallback={(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={goBack}>
          <div className="reader-surface flex h-[100dvh] sm:h-[92vh] w-full max-w-3xl items-center justify-center sm:rounded-[30px] shadow-2xl">
            <p className="text-sm font-medium text-[var(--muted)]">{t('loadingView')}</p>
          </div>
        </div>
      )}>
          <ArticleReaderModal
            key={activeArticle.id}
            article={activeArticle}
            allArticles={allArticles}
            perspectiveArticles={perspectiveArticles}
            sourceLanguage={sources.find(source => source.id === activeArticle.sourceId)?.language}
            translate={autoTranslate && Capacitor.getPlatform() === 'android' && sources.some(source => source.id === activeArticle.sourceId && source.language === 'en')}
            backgroundPlayback={backgroundPlayback}
            reducedMotion={reducedMotion}
            isBookmarked={normalizedProfile.bookmarkedIds.includes(activeArticle.id)}
            isLiked={normalizedProfile.likedIds.includes(activeArticle.id)}
            isDisliked={normalizedProfile.dislikedIds.includes(activeArticle.id)}
            inQueue={readingQueueIds.includes(activeArticle.id)}
            nextQueuedArticle={nextQueuedArticle}
            highlights={highlights}
            aiConfig={aiConfig}
            ttsConfig={ttsConfig}
            fontSize={fontSize}
            fontFamily={fontFamily}
            readerTheme={readerTheme}
            newspaperMode={newspaperMode}
            onFontSize={setFontSize}
            onFontFamily={setFontFamily}
            onReaderTheme={setReaderTheme}
            onNewspaperMode={setNewspaperMode}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleDislike={handleToggleDislike}
            onToggleQueue={handleToggleQueue}
            onAddHighlight={handleAddHighlight}
            onOpenArticle={handleOpenArticle}
            onPlayRelatedAudio={link => {
              setBriefingStopSignal(n => n + 1);
              setActiveAudio({ article: link.article, media: link.media });
            }}
            onOpenRelatedClip={link => {
              setPendingClipUrl(link.media.url);
              navigate({ tab: 'media' });
            }}
            onRecordReadingDuration={handleRecordReadingDuration}
            onOpenAISettings={() => openSettings('ai')}
            onBeforeSpeak={() => {
              setActiveAudio(null);
              setAudioQueue([]);
              setBriefingStopSignal(n => n + 1);
            }}
            showSummary={Boolean(location.summary)}
            onOpenSummary={() => navigate({ article: activeArticle, summary: true })}
            onClose={goBack}
            initialReadingRatio={readingProgress[activeArticle.id]?.ratio}
            onSaveReadingProgress={handleSaveReadingProgress}
            previousArticle={readerNeighbors.previous}
            nextArticle={readerNeighbors.next}
            articlePosition={readerNeighbors.index >= 0 ? { current: readerNeighbors.index + 1, total: readerNeighbors.total } : undefined}
            onSearchTopic={() => navigate({ tab: 'discover' })}
            allowFullText={Boolean(activeArticle.sourceId && (preferences.fullTextSourceIds ?? []).includes(activeArticle.sourceId))}
            onEnableFullText={sourceId => {
              setPreferences(prev => {
                const current = prev.fullTextSourceIds ?? [];
                return current.includes(sourceId) ? prev : { ...prev, fullTextSourceIds: [...current, sourceId] };
              });
            }}
            onDisableFullText={sourceId => {
              setPreferences(prev => ({
                ...prev,
                fullTextSourceIds: (prev.fullTextSourceIds ?? []).filter(id => id !== sourceId),
              }));
            }}
          />
      </Suspense>
      </ErrorBoundary>
      )}
      </>}
    </div>
    </I18nProvider>
  );
}
