import React, { useMemo, useRef, useState } from 'react';
import { ArrowDown, Bell, LoaderCircle, Sparkles } from 'lucide-react';
import type { NewsArticle, PersonalizationProfile } from '../types/news';
import { type ScoredArticle } from '../lib/personalization';
import type { Edition, HomeTab } from '../lib/preferences';
import { CompactArticleCard, HeroArticleCard } from './ArticleCards';

interface HomeViewProps {
  scoredArticles: ScoredArticle[];
  showHero: boolean;
  selectedCategory: HomeTab;
  tabs: HomeTab[];
  edition: Edition;
  onSelectCategory: (cat: HomeTab) => void;
  profile: PersonalizationProfile;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onOpenNotifications: () => void;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  scoredArticles,
  showHero,
  selectedCategory,
  tabs,
  edition,
  onSelectCategory,
  profile,
  isLoading,
  onRefresh,
  onOpenNotifications,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
}) => {
  const gesture = useRef<{ x: number; y: number; distance: number } | null>(null);
  const [pull, setPull] = useState(0);
  const [gestureRefresh, setGestureRefresh] = useState(false);
  const pullThreshold = 72;

  const resetPull = () => {
    gesture.current = null;
    setPull(0);
  };

  const [batch, setBatch] = useState({ category: selectedCategory, limit: 30 });
  const visibleLimit = batch.category === selectedCategory ? batch.limit : 30;
  const results = useMemo(() => {
    if (selectedCategory === 'Für dich') return scoredArticles;
    if (selectedCategory === 'Eilmeldungen') return scoredArticles.filter(({ article }) => article.isBreaking)
      .sort((a, b) => b.article.publishedAt.localeCompare(a.article.publishedAt));
    if (selectedCategory === 'Alle') return [...scoredArticles].sort((a, b) => b.article.publishedAt.localeCompare(a.article.publishedAt));
    if (selectedCategory === 'Schlagzeilen') {
      const latest = [...scoredArticles].sort((a, b) =>
        Number(Boolean(b.article.isBreaking)) - Number(Boolean(a.article.isBreaking))
        || b.article.publishedAt.localeCompare(a.article.publishedAt));
      return latest.filter((entry, index) => latest.findIndex(item => item.article.sourceId === entry.article.sourceId) === index);
    }
    return scoredArticles.filter(({ article }) => article.category === selectedCategory);
  }, [scoredArticles, selectedCategory]);
  const filtered = results.slice(0, visibleLimit);

  const heroEntry = showHero ? filtered[0] : undefined;
  const featuredSideEntries = heroEntry ? filtered.slice(1, 4) : [];
  const restEntries = heroEntry ? filtered.slice(4) : filtered;

  return (
    <section aria-label="Startseite Nachrichten" className="space-y-5" data-edition={edition}
      onTouchStart={event => {
        if (window.scrollY > 1 || isLoading || event.touches.length !== 1) return;
        const { clientX, clientY } = event.touches[0];
        gesture.current = { x: clientX, y: clientY, distance: 0 };
      }}
      onTouchMove={event => {
        const start = gesture.current;
        if (!start) return;
        if (window.scrollY > 1 || event.touches.length !== 1) {
          resetPull();
          return;
        }
        const { clientX, clientY } = event.touches[0];
        const dy = clientY - start.y;
        if (dy < -8 || Math.abs(clientX - start.x) > Math.max(12, dy)) {
          resetPull();
          return;
        }
        start.distance = Math.max(0, dy);
        setPull(Math.min(48, start.distance * 0.55));
      }}
      onTouchEnd={() => {
        const shouldRefresh = (gesture.current?.distance ?? 0) >= pullThreshold;
        resetPull();
        if (shouldRefresh && !isLoading) {
          setGestureRefresh(true);
          void Promise.resolve(onRefresh()).finally(() => setGestureRefresh(false));
        }
      }}
      onTouchCancel={resetPull}>
      <div className="relative">
        {(pull > 0 || gestureRefresh) && (
          <div className="pull-indicator" role="status" style={{ transform: `translate(-50%, ${gestureRefresh ? 26 : pull}px)` }}>
            {gestureRefresh ? <LoaderCircle size={17} className="animate-spin" aria-label="Nachrichten werden aktualisiert" />
              : <ArrowDown size={17} aria-label="Zum Aktualisieren nach unten ziehen" />}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-slate-900 dark:text-white">Heute</h1>
          <button type="button" className="glass-icon md:hidden" aria-label="Benachrichtigungen öffnen" onClick={onOpenNotifications}>
            <Bell size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="Nachrichten-Rubriken"
        className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      >
        {tabs.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onSelectCategory(cat)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                active
                  ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'liquid-glass-subtle text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {cat === 'Für dich' && <Sparkles className="h-3.5 w-3.5" />}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Feed Content */}
      {filtered.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {isLoading ? 'Nachrichten werden geladen …' : `Keine Artikel in „${selectedCategory}“ gefunden`}
          </p>
          {!isLoading && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Aktiviere weitere RSS-Quellen in den Einstellungen oder wähle eine andere Rubrik.
          </p>}
          {selectedCategory !== tabs[0] && <button type="button" className="choice-pill mt-4" onClick={() => onSelectCategory(tabs[0])}>
            Zu „{tabs[0]}“
          </button>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
            {heroEntry && (
              <div className={featuredSideEntries.length > 0 ? 'lg:col-span-7 flex' : 'lg:col-span-12'}>
                <HeroArticleCard
                  article={heroEntry.article}
                  badgeLabel="Top-Thema"
                  className="w-full"
                  isBookmarked={profile.bookmarkedIds.includes(heroEntry.article.id)}
                  isLiked={profile.likedIds.includes(heroEntry.article.id)}
                  onOpen={onOpenArticle}
                  onToggleBookmark={onToggleBookmark}
                  onToggleLike={onToggleLike}
                />
              </div>
            )}

            {featuredSideEntries.length > 0 && (
              <div className="lg:col-span-5 flex flex-col justify-between gap-3">
                {featuredSideEntries.map(({ article }) => (
                  <CompactArticleCard
                    key={article.id}
                    article={article}
                    isBookmarked={profile.bookmarkedIds.includes(article.id)}
                    isLiked={profile.likedIds.includes(article.id)}
                    onOpen={onOpenArticle}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                  />
                ))}
              </div>
            )}
          </div>

          {restEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {restEntries.map(({ article }) => (
                <CompactArticleCard
                  key={article.id}
                  article={article}
                  isBookmarked={profile.bookmarkedIds.includes(article.id)}
                  isLiked={profile.likedIds.includes(article.id)}
                  onOpen={onOpenArticle}
                  onToggleBookmark={onToggleBookmark}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
          {results.length > visibleLimit && <button type="button" className="choice-pill" onClick={() =>
            setBatch({ category: selectedCategory, limit: visibleLimit + 30 })}>Weitere Meldungen</button>}
        </div>
      )}
    </section>
  );
};
