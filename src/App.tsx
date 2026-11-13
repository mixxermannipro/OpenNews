import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { fetchNativeFeeds } from './lib/nativeFeed';
import { Bell, Bookmark, Compass, Home, Search, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type {
  AIProviderConfig,
  AppTab,
  FormatPreferences,
  NewsArticle,
  NewsCategory,
  NewsSource,
  NotificationSettings,
  PersonalizationProfile,
  ReaderFontFamily,
  ReaderFontSize,
  SourceApiKeys,
  ThemeMode,
} from './types/news';
import { DEFAULT_AI_CONFIG } from './lib/aiClient';
import { DEFAULT_SOURCES } from './lib/catalog';
import {
  createDefaultProfile,
  normalizeProfile,
  rankArticlesForYou,
  recordArticleRead,
  recordReadingDuration,
  toggleArticleBookmark,
  toggleArticleDislike,
  toggleArticleLike,
} from './lib/personalization';
import { SEED_ARTICLES } from './lib/seedArticles';
import { useLocalStorage } from './hooks/useLocalStorage';
import { HomeView } from './components/HomeView';
import { DiscoverView } from './components/DiscoverView';
import { SavedView, SearchView } from './components/SavedAndSearchViews';
import { ArticleReaderModal } from './components/ArticleReaderModal';
import { SettingsView, type SettingsSectionTab } from './components/SettingsView';
import { OfflineIndicator } from './components/PWAInstallButton';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionTab>('overview');
  const [homeCategory, setHomeCategory] = useState<NewsCategory>('Für dich');

  // Supports 'dark' (default), 'light', and 'system' (device preference)
  const [theme, setTheme] = useLocalStorage<ThemeMode>('opennews_theme', 'dark');
  const [sources, setSources] = useLocalStorage<NewsSource[]>('opennews_sources', DEFAULT_SOURCES);
  const [profile, setProfile] = useLocalStorage<PersonalizationProfile>(
    'opennews_profile',
    createDefaultProfile()
  );
  const [aiConfig, setAiConfig] = useLocalStorage<AIProviderConfig>(
    'opennews_ai_config',
    DEFAULT_AI_CONFIG
  );
  const [formatPrefs, setFormatPrefs] = useLocalStorage<FormatPreferences>('opennews_formats', {
    rssAtom: true,
    jsonFeed: true,
    openData: true,
    podcasts: false,
  });
  const [sourceKeys, setSourceKeys] = useLocalStorage<SourceApiKeys>('opennews_source_keys', {});
  const [notifications, setNotifications] = useLocalStorage<NotificationSettings>(
    'opennews_notifications',
    { enabled: false, breakingOnly: true, topics: ['Politik', 'Technologie'] }
  );
  const [fontSize, setFontSize] = useLocalStorage<ReaderFontSize>('opennews_font_size', 'normal');
  const [fontFamily, setFontFamily] = useLocalStorage<ReaderFontFamily>(
    'opennews_font_family',
    'sans'
  );

  const [cachedLiveArticles, setCachedLiveArticles] = useLocalStorage<NewsArticle[]>(
    'opennews_cached_articles',
    []
  );
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
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
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', resolvedDark ? '#08090C' : '#E7ECF2');
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
      if (e.key === 'Escape' && activeArticle) {
        setActiveArticle(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeArticle]);

  const enabledFormats = useMemo(() => {
    return new Set<string>([
      ...(formatPrefs.rssAtom ? ['rss', 'atom'] : []),
      ...(formatPrefs.jsonFeed ? ['json'] : []),
      ...(formatPrefs.openData ? ['opendata'] : []),
      ...(formatPrefs.podcasts ? ['podcast'] : []),
    ]);
  }, [formatPrefs]);

  const activeSources = useMemo(
    () => sources.filter((s) => s.subscribed && (enabledFormats.has(s.format) || s.isCustom)),
    [sources, enabledFormats]
  );

  const fetchLiveFeeds = useCallback(async () => {
    if (activeSources.length === 0) return;
    setIsLoadingFeeds(true);
    try {
      // Capacitor runs as a standalone APK: there is no local Node/Express server.
      // Native HTTP fetches feeds directly and parses them on-device.
      let articles: NewsArticle[] = [];
      if (Capacitor.isNativePlatform()) {
        articles = await fetchNativeFeeds(activeSources);
      } else {
        const resp = await fetch('/api/feeds/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feeds: activeSources }),
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { articles?: NewsArticle[] };
        articles = Array.isArray(data.articles) ? data.articles : [];
      }
      if (articles.length > 0) {
        const seen = new Set<string>();
        const deduped = articles.filter((a) => {
          const key = a.title.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setCachedLiveArticles(deduped.slice(0, 140));
      }
    } catch {
      // Offline or sandboxed: keep seed + cached articles gracefully
    } finally {
      setIsLoadingFeeds(false);
    }
  }, [activeSources, setCachedLiveArticles]);

  useEffect(() => {
    fetchLiveFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allArticles = useMemo(() => {
    const merged = [...cachedLiveArticles, ...SEED_ARTICLES];
    const seen = new Set<string>();
    return merged.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [cachedLiveArticles]);

  const normalizedProfile = useMemo(() => normalizeProfile(profile), [profile]);

  const scoredArticles = useMemo(
    () => rankArticlesForYou(allArticles, normalizedProfile, sources),
    [allArticles, normalizedProfile, sources]
  );

  const openSettings = (sec: SettingsSectionTab = 'overview') => {
    setSettingsSection(sec);
    setActiveTab('settings');
  };

  const handleOpenArticle = (article: NewsArticle) => {
    setActiveArticle(article);
    setProfile((prev) => recordArticleRead(normalizeProfile(prev), article));
  };

  const handleToggleBookmark = (article: NewsArticle) => {
    setProfile((prev) => toggleArticleBookmark(normalizeProfile(prev), article));
  };

  const handleToggleLike = (article: NewsArticle) => {
    setProfile((prev) => toggleArticleLike(normalizeProfile(prev), article));
  };

  const handleToggleDislike = (article: NewsArticle) => {
    setProfile((prev) => toggleArticleDislike(normalizeProfile(prev), article));
    setActiveArticle(null);
  };

  const handleRecordReadingDuration = useCallback(
    (article: NewsArticle, seconds: number) => {
      setProfile((prev) => recordReadingDuration(normalizeProfile(prev), article, seconds));
    },
    [setProfile]
  );

  const handleUpdateSource = (sourceId: string, updates: Partial<NewsSource>) => {
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)));
  };

  const handleToggleSubscribe = (sourceId: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, subscribed: !s.subscribed } : s))
    );
  };

  const handleSendTestNotification = () => {
    const top = scoredArticles[0]?.article || SEED_ARTICLES[0];
    setAlertBanner({ title: top.title, source: top.sourceName });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`OpenNews · ${top.sourceName}`, {
          body: top.title,
          icon: '/pwa-192x192.png',
        });
      } catch {
        // Ignore on environments restricting window Notification
      }
    }
    setTimeout(() => setAlertBanner(null), 5000);
  };

  const navItems: Array<{ id: Exclude<AppTab, 'settings'>; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
    { id: 'discover', label: 'Entdecken', icon: <Compass className="h-5 w-5" /> },
    { id: 'saved', label: 'Gespeichert', icon: <Bookmark className="h-5 w-5" /> },
    { id: 'search', label: 'Suche', icon: <Search className="h-5 w-5" /> },
  ];

  return (
    <div className="opennews-canvas min-h-screen text-[#111318] dark:text-[#F4F6FA] transition-colors duration-200">
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

      {/* Desktop Top Bar (3-zone contract) */}
      <header className="hidden md:block sticky top-0 z-30 border-b border-black/[0.06] bg-white/55 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-[#08090D]/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            OpenNews
          </button>

          <nav aria-label="Hauptnavigation" className="flex items-center gap-6">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[40px] px-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-slate-900 dark:text-white underline decoration-blue-500 decoration-2 underline-offset-8'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openSettings('overview')}
              className={`liquid-glass inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition hover:scale-[1.02] ${
                activeTab === 'settings'
                  ? 'ring-2 ring-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Quellen &amp; KI
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-14 md:pt-8">
        {activeTab === 'home' && (
          <HomeView
            scoredArticles={scoredArticles}
            allArticlesCount={allArticles.length}
            selectedCategory={homeCategory}
            onSelectCategory={setHomeCategory}
            profile={normalizedProfile}
            isLoading={isLoadingFeeds}
            onRefresh={fetchLiveFeeds}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onOpenSettings={() => openSettings('overview')}
          />
        )}

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
            articles={allArticles}
            sources={sources}
            profile={normalizedProfile}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onResetAlgorithm={() => setProfile(createDefaultProfile())}
          />
        )}

        {activeTab === 'search' && (
          <SearchView
            articles={allArticles}
            profile={normalizedProfile}
            onOpenArticle={handleOpenArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            key={settingsSection}
            initialSection={settingsSection}
            sources={sources}
            formatPrefs={formatPrefs}
            sourceKeys={sourceKeys}
            aiConfig={aiConfig}
            theme={theme}
            notifications={notifications}
            onToggleSource={handleToggleSubscribe}
            onAddCustomSource={(src) => setSources((prev) => [src, ...prev])}
            onUpdateSource={handleUpdateSource}
            onRemoveCustomSource={(id) =>
              setSources((prev) => prev.filter((s) => s.id !== id))
            }
            onUpdateFormatPrefs={setFormatPrefs}
            onUpdateSourceKeys={setSourceKeys}
            onUpdateAIConfig={setAiConfig}
            onChangeTheme={setTheme}
            onUpdateNotifications={setNotifications}
            onSendTestNotification={handleSendTestNotification}
            onResetAlgorithm={() => setProfile(createDefaultProfile())}
            onBackHome={() => setActiveTab('home')}
          />
        )}
      </main>

      {/* Mobile Floating Liquid Glass Bottom Tab Bar matching Screenshots 1, 2, 4 */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed inset-x-3 bottom-3 z-40">
        <div className="liquid-glass-dock mx-auto grid max-w-md grid-cols-4 items-center rounded-[30px] p-1.5">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const visualActive = active || (activeTab === 'settings' && item.id === 'home');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-[24px] px-2 py-1 transition active:scale-95 ${
                  visualActive
                    ? 'bg-black/[0.07] text-slate-950 dark:bg-white/[0.13] dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Article Reader Sheet */}
      <AnimatePresence>
        {activeArticle && (
          <ArticleReaderModal
            article={activeArticle}
            isBookmarked={normalizedProfile.bookmarkedIds.includes(activeArticle.id)}
            isLiked={normalizedProfile.likedIds.includes(activeArticle.id)}
            isDisliked={normalizedProfile.dislikedIds.includes(activeArticle.id)}
            aiConfig={aiConfig}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onChangeFontSize={setFontSize}
            onChangeFontFamily={setFontFamily}
            onToggleBookmark={handleToggleBookmark}
            onToggleLike={handleToggleLike}
            onToggleDislike={handleToggleDislike}
            onRecordReadingDuration={handleRecordReadingDuration}
            onOpenAISettings={() => {
              setActiveArticle(null);
              openSettings('ai');
            }}
            onClose={() => setActiveArticle(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
