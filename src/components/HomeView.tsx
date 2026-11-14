import React, { useMemo, useRef, useState } from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
import type { NewsArticle, PersonalizationProfile } from '../types/news';
import { clusterStories } from '../lib/storyClusters';
import { HOME_TABS, type HomeTab } from '../lib/preferences';
import { ViewStatus } from './ViewStatus';
import { CompactArticleCard, HeadlineArticleCard } from './ArticleCards';

interface HomeViewProps {
  articles: NewsArticle[];
  showHero: boolean;
  briefing?: React.ReactNode;
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
  briefing,
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
  const stories = useMemo(() => clusterStories(articles), [articles]);
  const reportsById = useMemo(() => new Map(stories.map(story => [story.lead.id, story.reports])), [stories]);
  const visibleArticles = stories.slice(0, visibleLimit).map(story => story.lead);
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

  const related = (article: NewsArticle) => {
    const reports = reportsById.get(article.id) ?? [];
    const sources = new Set(reports.map(report => report.sourceId)).size;
    if (reports.length < 2) return null;
    return (
      <details className="px-2 py-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center">{sources > 1 ? `${sources} Quellen berichten` : 'Weitere Berichte'}</summary>
        <ul className="space-y-1 pt-2">
          {reports.slice(1).map(report => (
            <li key={report.id}>
              <button className="min-h-11 text-left underline" type="button" onClick={() => onOpenArticle(report)}>
                {report.sourceName} · {report.title}
              </button>
            </li>
          ))}
        </ul>
      </details>
    );
  };

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
        <div className="screen-heading">
          <h1>Startseite</h1>
          <p>{new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
        </div>
      </div>

      <div role="group" aria-label="Ansicht der Startseite" className="segmented-control home-tabs">
        {HOME_TABS.map(cat => (
          <button key={cat} type="button" aria-pressed={selectedCategory === cat}
            onClick={() => onSelectCategory(cat)} className="choice-pill">
            {cat}
          </button>
        ))}
      </div>

      {briefing}
      {visibleArticles.length === 0 ? (
        <ViewStatus
          title={isLoading ? 'Nachrichten werden geladen …' : selectedCategory === 'Heute'
            ? 'Heute sind noch keine Meldungen verfügbar'
            : selectedCategory === 'Für dich' ? 'Keine aktuellen Empfehlungen verfügbar' : 'Keine Meldungen verfügbar'}
          action={!isLoading && (selectedCategory === 'Neueste'
            ? <button type="button" className="choice-pill" onClick={() => void onRefresh()}>Feeds aktualisieren</button>
            : <button type="button" className="choice-pill" onClick={() => onSelectCategory('Neueste')}>Zu „Neueste“</button>)}
        />
      ) : (
        <div className="space-y-5">
          {isToday ? (
            <>
              {lead && <div><HeadlineArticleCard {...cardProps(lead)} lead />{related(lead)}</div>}
              {headlines.length > 0 && (
                <section aria-labelledby="today-headlines">
                  <h2 id="today-headlines" className="mb-3 text-xl font-bold tracking-tight">Schlagzeilen</h2>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-5 lg:grid-cols-4">
                    {headlines.slice(0, overviewCount).map(article => (
                      <div key={article.id}><HeadlineArticleCard {...cardProps(article)} />{related(article)}</div>
                    ))}
                  </div>
                </section>
              )}
              {headlines.length > overviewCount && (
                <section aria-labelledby="today-more">
                  <h2 id="today-more" className="mb-3 text-xl font-bold tracking-tight">Weitere Meldungen</h2>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {headlines.slice(overviewCount).map(article => (
                      <div key={article.id}><CompactArticleCard {...cardProps(article)} />{related(article)}</div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {visibleArticles.map(article => (
                <div key={article.id}><CompactArticleCard {...cardProps(article)} />{related(article)}</div>
              ))}
            </div>
          )}
          {stories.length > visibleLimit && <button type="button" className="choice-pill" onClick={() =>
            setBatch({ category: selectedCategory, limit: visibleLimit + 30 })}>Weitere Meldungen</button>}
        </div>
      )}
    </section>
  );
};
