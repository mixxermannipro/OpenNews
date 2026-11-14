import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NewsPush } from './lib/newsPush';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { fetchNativeFeeds } from './lib/nativeFeed';
import { Bell, Compass, Home, Clapperboard, User } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
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
  SourceApiKeys,
  ThemeMode,
} from './types/news';
import { DEFAULT_AI_CONFIG, migrateAIConfig } from './lib/aiClient';
import { clipSourceIds, DEFAULT_SOURCES, legacyCatalogUrls, pushSources } from './lib/catalog';
import {
  createDefaultProfile,
  decayProfileWeights,
  resetProfileWeights,
  normalizeProfile,
  recordArticleRead,
  recordReadingDuration,
  rankArticlesForYou,
  toggleArticleBookmark,
  toggleArticleDislike,
  toggleArticleLike,
} from './lib/personalization';
import { articleIdentity, buildHomeSections, distinctArticles, mergeFeedArticles, pruneFeedArticles } from './lib/newsFeed';
import { SEED_ARTICLES } from './lib/seedArticles';
import { trackNavigationScroll } from './lib/scrollNavigation';
import { useArticleStorage } from './hooks/useArticleStorage';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ViewStatus } from './components/ViewStatus';
import { HomeView } from './components/HomeView';
import type { SettingsSectionTab } from './components/SettingsView';

import { recordDiagnostic } from './lib/diagnostics';
import { OfflineIndicator } from './components/PWAInstallButton';

import { DEFAULT_PREFERENCES, applyEditionSources, resolveHomeTab, resolveRetention, type AppPreferences, type HomeTab } from './lib/preferences';
import { Onboarding, ProfileView, type ProfilePage } from './components/Preferences';

const AudioBriefing = lazy(() => import('./components/AudioBriefing').then(module => ({ default: module.AudioBriefing })));
const DiscoverView = lazy(() => import('./components/DiscoverView').then(module => ({ default: module.DiscoverView })));
const SavedView = lazy(() => import('./components/SavedView').then(module => ({ default: module.SavedView })));
const MediaView = lazy(() => import('./components/MediaView').then(module => ({ default: module.MediaView })));
const ArticleReaderModal = lazy(() => import('./components/ArticleReaderModal').then(module => ({ default: module.ArticleReaderModal })));
const SettingsView = lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));

type AppLocation = {
  tab: AppTab;
  profile: ProfilePage;
  settings: SettingsSectionTab;
  saved: 'bookmarks' | 'history';
  article: NewsArticle | null;
  summary?: boolean;
};
const HOME_LOCATION: AppLocation = { tab: 'home', profile: 'profile', settings: 'overview', saved: 'bookmarks', article: null };

export default function App() {
  const [location, setLocation] = useState<AppLocation>(HOME_LOCATION);
  const { tab: activeTab, settings: settingsSection, profile: profilePage, saved: savedPage, article: activeArticle } = location;
  const navigate = (next: Partial<AppLocation>) => {
    const destination = { ...location, article: null, summary: false, ...next };
    if (JSON.stringify(destination) === JSON.stringify(location)) return;
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
  const [preferences, setPreferences] = useLocalStorage<AppPreferences>('opennews_preferences', DEFAULT_PREFERENCES);
  const [homeCategory, setHomeCategory] = useState<HomeTab>(() => resolveHomeTab(preferences.home));
  const retention = resolveRetention(preferences.retention);
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
  const aiConfig = useMemo(() => aiConfigMigrated ? storedAIConfig : migrateAIConfig(storedAIConfig), [storedAIConfig, aiConfigMigrated]);
  const updateAIConfig = (next: AIProviderConfig) => {
    setAiConfig(next);
    setAIConfigMigrated(true);
  };

  const [formatPrefs, setFormatPrefs] = useLocalStorage<FormatPreferences>('opennews_formats', {
    rssAtom: true,
    jsonFeed: true,
    openData: true,
    podcasts: false,
  });
  const [sourceKeys, setSourceKeys] = useLocalStorage<SourceApiKeys>('opennews_source_keys', {});
  const [notifications, setNotifications] = useLocalStorage<NotificationSettings>(
    'opennews_notifications',
    { enabled: false, breakingOnly: false, topics: [] }
  );
  const [fontSize, setFontSize] = useLocalStorage<ReaderFontSize>('opennews_font_size', 'normal');
  const [fontFamily, setFontFamily] = useLocalStorage<ReaderFontFamily>(
    'opennews_font_family',
    'sans'
  );

  const [cachedLiveArticles, setCachedLiveArticles, cachedStorageFailed, cachedStorageReady] = useArticleStorage<NewsArticle[]>(
    'opennews_cached_articles',
    []
  );
  const [feedClock, setFeedClock] = useState(Date.now);
  useEffect(() => {
    const updateClock = () => setFeedClock(Date.now());
    const timer = window.setInterval(updateClock, 60_000);
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
    if (cachedStorageFailed || savedStorageFailed || historyStorageFailed) recordDiagnostic('storage-failed');
  }, [cachedStorageFailed, savedStorageFailed, historyStorageFailed]);
  const [alertBanner, setAlertBanner] = useState<{ title: string; source: string } | null>(null);

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
        metaTheme.setAttribute('content', resolvedDark ? '#111214' : '#f6f5f2');
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

  const [pushStatus, setPushStatus] = useState('');
  const pushSourceIds = useMemo(() => activeSources
    .filter(source => pushSources.some(candidate => candidate.id === source.id && candidate.url === source.url))
    .map(source => source.id), [activeSources]);

  const configurePush = useCallback(async (settings: NotificationSettings, prompt = false) => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const { status } = await NewsPush.configure({ ...settings, sources: pushSourceIds, prompt });
      setPushStatus(status === 'unconfigured' ? 'Dieser Build hat noch keine Firebase-Verbindung.'
        : status === 'denied' ? 'Erlaube Benachrichtigungen in den Android-Einstellungen.'
        : settings.enabled && !pushSourceIds.length ? 'Aktiviere mindestens eine unterstützte Nachrichtenquelle.'
        : settings.enabled ? 'Android-Push ist für unterstützte Quellen angemeldet.' : '');
    } catch {
      setPushStatus('Push-Anmeldung gerade nicht möglich.');
    }
  }, [pushSourceIds]);

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

  // Keep a copy of saved articles even when they leave the feed or it is paused.
  const savedIds = useMemo(
    () => new Set([...normalizedProfile.bookmarkedIds, ...normalizedProfile.likedIds]),
    [normalizedProfile]
  );
  useEffect(() => {
    setSavedArticles(previous => {
      const entries = new Map(Object.entries(previous).filter(([id]) => savedIds.has(id)));
      for (const article of [...cachedLiveArticles, ...readArticles, ...SEED_ARTICLES]) {
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
    if (!firstLoad && notifications.enabled && withinWindow && document.visibilityState === 'visible' && candidate) {
      showAlert(candidate.title, candidate.sourceName);
    }
  }, [notifications, showAlert]);

  useEffect(() => {
    if (!sources.some(source => source.subscribed && feedHealth[source.id]?.url === source.url && feedHealth[source.id].consecutiveFailures >= 5)) return;
    setSources(previous => previous.map(source => source.subscribed && feedHealth[source.id]?.url === source.url
      && feedHealth[source.id].consecutiveFailures >= 5 ? { ...source, subscribed: false } : source));
  }, [sources, feedHealth, setSources]);

  const fetchLiveFeeds = useCallback(async () => {
    if (!cachedStorageReady || refresh.current || !activeSources.length || !navigator.onLine) return;
    const controller = new AbortController();
    refresh.current = controller;
    setIsLoadingFeeds(true);

    const applyArticles = (articles: NewsArticle[]) => {
      if (controller.signal.aborted || !articles.length) return;
      const now = Date.now();
      setFeedClock(now);
      checkForAlert(articles);
      setCachedLiveArticles(previous => controller.signal.aborted
        ? previous
        : mergeFeedArticles(previous, articles, latestRetention.current, now));
    };

    const recordResults = (results: FeedResult[]) => {
      if (controller.signal.aborted || !results.length) return;
      if (results.some(result => !result.ok)) recordDiagnostic('feed-failed');
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

    try {
      if (Capacitor.isNativePlatform()) {
        await fetchNativeFeeds(activeSources, applyArticles, controller.signal, undefined, result => recordResults([result]));
      } else {
        for (let i = 0; i < activeSources.length && !controller.signal.aborted; i += 6) {
          const resp = await fetch('/api/feeds/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feeds: activeSources.slice(i, i + 6) }),
            signal: controller.signal,
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.articles)) applyArticles(data.articles);
            if (Array.isArray(data.feedStatuses)) recordResults(data.feedStatuses);
          }
        }
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
  }, [activeSources, cachedStorageReady, checkForAlert, setCachedLiveArticles, setFeedHealth]);

  const fetchLatest = useRef(fetchLiveFeeds);
  useEffect(() => { fetchLatest.current = fetchLiveFeeds; }, [fetchLiveFeeds]);
  useEffect(() => {
    void fetchLatest.current();
    return () => {
      refresh.current?.abort();
      refresh.current = null;
      setIsLoadingFeeds(false);
    };
  }, [activeSources, cachedStorageReady]);

  useEffect(() => {
    const update = () => { if (!document.hidden) void fetchLatest.current(); };
    const timer = window.setInterval(update, 5 * 60_000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
    };
  }, []);

  const activeArticles = useMemo(() => {
    const activeIds = new Set(activeSources.map(source => source.id));
    return pruneFeedArticles(cachedLiveArticles, retention, feedClock)
      .filter(article => activeIds.has(article.sourceId));
  }, [activeSources, cachedLiveArticles, feedClock, retention]);

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
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const stories = homeSections.Heute.slice(0, 2).map(article => ({
      title: article.title.slice(0, 180), source: article.sourceName.slice(0, 80), category: article.category,
    }));
    if (!stories.length && isLoadingFeeds) return;
    void import('./lib/newsWidget').then(({ NewsWidget }) => NewsWidget.update({ stories })).catch(() => {});
  }, [homeSections.Heute, isLoadingFeeds]);


  const openSettings = (sec: SettingsSectionTab = 'overview') => {
    navigate({ tab: 'settings', settings: sec });
  };

  const handleOpenArticle = (article: NewsArticle) => {
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

  const handleToggleBookmark = (article: NewsArticle) => {
    if (!normalizedProfile.bookmarkedIds.includes(article.id)) {
      setSavedArticles(previous => ({ ...previous, [article.id]: article }));
    }
    setProfile((prev) => toggleArticleBookmark(normalizeProfile(prev), article));
  };

  const handleToggleLike = (article: NewsArticle) => {
    if (!normalizedProfile.likedIds.includes(article.id)) {
      setSavedArticles(previous => ({ ...previous, [article.id]: article }));
    }
    setProfile((prev) => toggleArticleLike(normalizeProfile(prev), article));
  };

  const handleToggleDislike = (article: NewsArticle) => {
    setProfile((prev) => toggleArticleDislike(normalizeProfile(prev), article));
    goBack();
  };

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

  const handleSendTestNotification = () => {
    if (Capacitor.getPlatform() === 'android') {
      void configurePush(notifications, true).then(() => NewsPush.test()).catch(() =>
        showAlert('Android hat Benachrichtigungen gesperrt.', 'OpenNews · Test'));
    } else {
      showAlert('Benachrichtigungen sind aktiv.', 'OpenNews · Test');
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

  const navItems = [
    { id: 'home', label: 'Heute', icon: Home, action: () => navigate({ tab: 'home' }) },
    { id: 'discover', label: 'Entdecken', icon: Compass, action: () => navigate({ tab: 'discover' }) },
    { id: 'media', label: 'Video & Audio', icon: Clapperboard, action: () => navigate({ tab: 'media' }) },
    { id: 'profile', label: 'Profil', icon: User, action: () => openProfile() },
  ] as const;
  const navIsActive = (id: string) => activeTab === id || (id === 'profile' && ['settings', 'saved'].includes(activeTab));
  const appearance = { theme, onTheme: setTheme, preferences, onPreferences: updatePreferences };
  const reducedMotion = preferences.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <MotionConfig reducedMotion={preferences.motion === 'reduced' ? 'always' : 'user'}>
    <div className="opennews-canvas" data-glass={preferences.glass} data-accent={preferences.accent}
      data-corners={preferences.corners} data-cards={preferences.cards} data-scale={preferences.textScale}
      data-motion={preferences.motion} data-feed-images={preferences.images}>
      {!onboarded ? <Onboarding {...appearance} onFinish={() => setOnboarded(true)} onConfigure={() => {
        setOnboarded(true);
        openProfile('preferences');
      }} /> : <>
      <OfflineIndicator />

      {/* In-App Breaking Notification Banner */}
      <AnimatePresence>
        {alertBanner && (
          <div
            role="status"
            className="liquid-glass fixed top-4 left-1/2 z-[60] flex w-[92%] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl p-3.5 shadow-xl"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-blue-500">{alertBanner.source}</p>
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {alertBanner.title}
              </p>
            </div>
          </div>
        )}
      </AnimatePresence>

      <header className="app-header hidden md:block" inert={activeArticle ? true : undefined}>
        <div className="app-header-inner">
          <button type="button" className="brand" onClick={() => navigate({ tab: 'home' })}>
            <img src="/logo.png" alt="" /> OpenNews
          </button>
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-2 md:flex">
            {navItems.map(item => (
              <button key={item.id} type="button" className="choice-pill" onClick={item.action}
                aria-current={navIsActive(item.id) ? 'page' : undefined} aria-pressed={navIsActive(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-content" inert={activeArticle ? true : undefined}>
        {(cachedStorageFailed || savedStorageFailed || historyStorageFailed) && (
          <p className="px-5 py-3 text-sm" role="status">
            Artikel konnten nicht dauerhaft gespeichert werden. Prüfe den freien Speicher deines Geräts.
          </p>
        )}
        {activeTab === 'home' && (
          <HomeView
            articles={homeSections[homeCategory]}
            briefing={homeCategory === 'Heute' && aiConfig.apiKey.trim() ? (
              <Suspense fallback={null}><AudioBriefing articles={homeSections.Heute} config={aiConfig} /></Suspense>
            ) : null}
            showHero={preferences.hero}
            selectedCategory={homeCategory}
            onSelectCategory={setHomeCategory}
            profile={normalizedProfile}
            isLoading={isLoadingFeeds}
            onRefresh={fetchLiveFeeds}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
          />
        )}

        <Suspense fallback={<ViewStatus title="Ansicht wird geladen …" />}>
        {activeTab === 'discover' && (
          <DiscoverView
            articles={allArticles}
            sources={sources}
            profile={normalizedProfile}
            onToggleSubscribe={handleToggleSubscribe}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onOpenSourcesSettings={() => openSettings('feeds')}
          />
        )}

        {activeTab === 'saved' && (
          <SavedView
            key={savedPage}
            initialPage={savedPage}
            history={distinctArticles([...readArticles, ...allArticles.filter(article => normalizedProfile.readIds.includes(article.id))])}
            articles={Object.values(savedArticles)}
            sources={sources}
            profile={normalizedProfile}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onResetAlgorithm={() => setProfile(previous => resetProfileWeights(normalizeProfile(previous)))}
          />
        )}

        {activeTab === 'media' && (
          <MediaView articles={mediaArticles} loading={isLoadingFeeds} background={backgroundPlayback}
            liked={normalizedProfile.likedIds} saved={normalizedProfile.bookmarkedIds}
            onLike={handleToggleLike} onSave={handleToggleBookmark}
            onEngaged={(article, seconds) => setProfile(previous => {
              const profile = normalizeProfile(previous);
              return profile.readIds.includes(article.id) ? profile
                : recordReadingDuration(recordArticleRead(profile, article), article, seconds);
            })}
            onArticle={handleOpenArticle} onSources={() => openSettings('feeds')} />
        )}

        {activeTab === 'profile' && <ProfileView {...appearance} page={profilePage} onPage={page => openProfile(page)} onBack={goBack}
          onSaved={() => openSaved('bookmarks')} onHistory={() => openSaved('history')}
          onSources={() => openSettings('feeds')} onAI={() => openSettings('ai')} onNotifications={() => openSettings('app')}
          backupControls={
            <div className="space-y-2">
              <p>Sichere Abos, Reaktionen und Lesezeichen als Datei. Beim Import werden die Einträge zusammengeführt.</p>
              <div className="flex flex-wrap gap-2">
                <button className="choice-pill" type="button" onClick={exportBackup}>Sicherung exportieren</button>
                <label className="choice-pill cursor-pointer">Sicherung importieren
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
          backgroundPlayback={backgroundPlayback} onBackgroundPlayback={setBackgroundPlayback}
          fontSize={fontSize} fontFamily={fontFamily} onFontSize={setFontSize} onFontFamily={setFontFamily} />}

        {activeTab === 'settings' && (
          <SettingsView
            key={settingsSection}
            feedHealth={feedHealth}
            initialSection={settingsSection}
            sources={sources}
            formatPrefs={formatPrefs}
            sourceKeys={sourceKeys}
            aiConfig={aiConfig}
            notifications={notifications}
            autoTranslate={autoTranslate}
            onAutoTranslate={setAutoTranslate}
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
            onAddCustomSource={(src) => setSources((prev) => prev.some(source => source.url === src.url) ? prev : [src, ...prev])}
            onUpdateSource={handleUpdateSource}
            onRemoveCustomSource={(id) =>
              setSources((prev) => prev.filter((s) => s.id !== id))
            }
            onUpdateFormatPrefs={setFormatPrefs}
            onUpdateSourceKeys={setSourceKeys}
            onUpdateAIConfig={updateAIConfig}
            pushStatus={pushStatus}
            onUpdateNotifications={next => {
              if (!notifications.enabled && next.enabled) void configurePush(next, true);
              setNotifications(next);
            }}
            onSendTestNotification={handleSendTestNotification}
            onResetAlgorithm={() => setProfile(previous => resetProfileWeights(normalizeProfile(previous)))}
            onBackHome={goBack}
          />
        )}
        </Suspense>
      </main>

      <nav aria-label="Mobile Navigation" className="mobile-navigation"
        data-scroll-hidden={navigationHidden} inert={activeArticle ? true : undefined}>
        <div className="liquid-glass-dock">
          {navItems.map(({ id, label, icon: Icon, action }) => (
            <button key={id} type="button" onClick={action}
              aria-current={navIsActive(id) ? 'page' : undefined} aria-label={label} className="dock-tab">
              {navIsActive(id) && <motion.span layoutId={reducedMotion ? undefined : 'dock-selection'} className="dock-selection"
                transition={{ type: 'spring', stiffness: 440, damping: 34 }} />}
              <Icon size={25} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>
      </nav>

      {/* Article Reader Sheet */}
      <Suspense fallback={<button className="fixed inset-0 z-50 bg-black/60 text-white" onClick={goBack}>Artikel wird geladen … Schließen</button>}>
      <AnimatePresence>
        {activeArticle && (
          <ArticleReaderModal
            key={activeArticle.id}
            article={activeArticle}
            translate={autoTranslate && Capacitor.getPlatform() === 'android' && sources.some(source => source.id === activeArticle.sourceId && source.language === 'en')}
            backgroundPlayback={backgroundPlayback}
            isBookmarked={normalizedProfile.bookmarkedIds.includes(activeArticle.id)}
            isLiked={normalizedProfile.likedIds.includes(activeArticle.id)}
            isDisliked={normalizedProfile.dislikedIds.includes(activeArticle.id)}
            aiConfig={aiConfig}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleDislike={handleToggleDislike}
            onRecordReadingDuration={handleRecordReadingDuration}
            onOpenAISettings={() => openSettings('ai')}
            showSummary={Boolean(location.summary)}
            onOpenSummary={() => navigate({ article: activeArticle, summary: true })}
            onClose={goBack}
          />
        )}
      </AnimatePresence>
      </Suspense>
      </>}
    </div>
    </MotionConfig>
  );
}
