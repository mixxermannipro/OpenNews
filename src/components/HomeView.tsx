import React, { useRef, useState } from 'react';
import { ArrowDown, LoaderCircle, Sparkles } from 'lucide-react';
import type { NewsArticle, PersonalizationProfile } from '../types/news';
import { HOME_TABS, type HomeTab } from '../lib/preferences';
import { CompactArticleCard, HeadlineArticleCard } from './ArticleCards';

interface HomeViewProps {
  articles: NewsArticle[];
  showHero: boolean;
  selectedCategory: HomeTab;
  onSelectCategory: (cat: HomeTab) => void;
  profile: PersonalizationProfile;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  articles,
  showHero,
  selectedCategory,
  onSelectCategory,
  profile,
  isLoading,
  onRefresh,
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
  const visibleArticles = articles.slice(0, visibleLimit);
  const isToday = selectedCategory === 'Heute';
  const lead = isToday && showHero ? visibleArticles[0] : undefined;
  const headlines = visibleArticles.slice(lead ? 1 : 0);
  const overviewCount = 4;
  const cardProps = (article: NewsArticle) => ({
    article,
    isBookmarked: profile.bookmarkedIds.includes(article.id),
    isLiked: profile.likedIds.includes(article.id),
    onOpen: onOpenArticle,
    onToggleBookmark,
    onToggleLike,
  });

  return (
    <section aria-label="Startseite Nachrichten" className="space-y-5"
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
        <div className={isToday ? 'flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-2 border-red-700 pb-2 dark:border-red-400' : undefined}>
          <h1 className="text-slate-900 dark:text-white">Heute</h1>
          <p className={isToday ? 'pb-0.5 text-sm font-medium text-slate-600 dark:text-slate-400' : 'mt-0.5 text-sm text-slate-500 dark:text-slate-400'}>
            {new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Ansicht der Startseite"
        className={`grid grid-cols-3 ${isToday ? 'gap-0 border-b border-slate-300 dark:border-slate-700' : 'gap-2'}`}
      >
        {HOME_TABS.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectCategory(cat)}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold whitespace-nowrap transition focus-visible:outline-2 ${
                isToday
                  ? active
                    ? 'min-h-11 border-b-2 border-slate-900 text-slate-950 dark:border-white dark:text-white'
                    : 'min-h-11 border-b-2 border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  : active
                    ? 'min-h-[40px] rounded-full active:scale-95 bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
                    : 'min-h-[40px] liquid-glass-subtle rounded-full active:scale-95 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {cat === 'Für dich' && <Sparkles className="h-3.5 w-3.5" />}
              {cat}
            </button>
          );
        })}
      </div>

      {visibleArticles.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {isLoading ? 'Nachrichten werden geladen …' : selectedCategory === 'Heute'
              ? 'Heute sind noch keine Meldungen verfügbar'
              : selectedCategory === 'Für dich' ? 'Keine aktuellen Empfehlungen verfügbar' : 'Keine Meldungen verfügbar'}
          </p>
          {!isLoading && selectedCategory !== 'Neueste' && <button type="button" className="choice-pill mt-4"
            onClick={() => onSelectCategory('Neueste')}>Zu „Neueste“</button>}
          {!isLoading && selectedCategory === 'Neueste' && <button type="button" className="choice-pill mt-4"
            onClick={() => void onRefresh()}>Feeds aktualisieren</button>}
        </div>
      ) : (
        <div className="space-y-5">
          {isToday ? (
            <>
              {lead && <HeadlineArticleCard {...cardProps(lead)} lead />}
              {headlines.length > 0 && (
                <section aria-labelledby="today-headlines">
                  <h2 id="today-headlines" className="mb-3 text-xl font-bold tracking-tight">Schlagzeilen</h2>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-5 lg:grid-cols-4">
                    {headlines.slice(0, overviewCount).map(article => (
                      <HeadlineArticleCard key={article.id} {...cardProps(article)} />
                    ))}
                  </div>
                </section>
              )}
              {headlines.length > overviewCount && (
                <section aria-labelledby="today-more">
                  <h2 id="today-more" className="mb-3 text-xl font-bold tracking-tight">Weitere Meldungen</h2>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {headlines.slice(overviewCount).map(article => (
                      <CompactArticleCard key={article.id} {...cardProps(article)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {visibleArticles.map(article => (
                <CompactArticleCard key={article.id} {...cardProps(article)} />
              ))}
            </div>
          )}
          {articles.length > visibleLimit && <button type="button" className="choice-pill" onClick={() =>
            setBatch({ category: selectedCategory, limit: visibleLimit + 30 })}>Weitere Meldungen</button>}
        </div>
      )}
    </section>
  );
};
