import React, { useRef, useState } from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
import type { NewsArticle, PersonalizationProfile } from '../types/news';
import type { HomeStory } from '../lib/newsFeed';
import { HOME_TABS, type HomeTab } from '../lib/preferences';
import { featuredStoryIds } from '../lib/featuredStories';
import { ViewStatus } from './ViewStatus';
import { CompactArticleCard, HeadlineArticleCard } from './ArticleCards';

const timelineDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'full' });

interface HomeViewProps {
  stories: HomeStory[];
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
  stories,
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
  const visibleArticles = stories.slice(0, visibleLimit);
  const isToday = selectedCategory === 'Heute';
  const isLatest = selectedCategory === 'Neueste';
  const lead = isToday && showHero ? visibleArticles[0] : undefined;
  const headlines = visibleArticles.slice(lead ? 1 : 0);
  const overviewCount = 5;
  const featured = showHero && !isLatest ? featuredStoryIds(isToday ? headlines : visibleArticles, {
    featureLead: selectedCategory === 'Für dich',
  }) : new Set<string>();
  const viewDescription = isToday ? 'Die Tagesagenda aus deinen Quellen.'
    : selectedCategory === 'Für dich' ? 'Aktuelle Vorschläge anhand deiner Interessen auf diesem Gerät.'
    : 'Nach Veröffentlichungszeit, neueste zuerst.';
  const cardProps = ({ lead: article }: HomeStory) => ({
    article,
    isBookmarked: profile.bookmarkedIds.includes(article.id),
    isLiked: profile.likedIds.includes(article.id),
    onOpen: onOpenArticle,
    onToggleBookmark,
    onToggleLike,
  });

  const related = ({ reports }: HomeStory) => {
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

  const storyDetails = (story: HomeStory) => <>
    {story.reason && <p className="px-2 pt-1 text-sm text-[var(--muted)]">{story.reason}</p>}
    {related(story)}
  </>;

  const renderStories = (items: HomeStory[]) => items.map(story => {
    const large = featured.has(story.lead.id);
    const Card = large ? HeadlineArticleCard : CompactArticleCard;
    return (
      <div key={story.lead.id} className={large ? 'md:col-span-2' : undefined}>
        <Card {...cardProps(story)} />
        {storyDetails(story)}
      </div>
    );
  });
  const days = new Map<string, HomeStory[]>();
  if (isLatest) {
    for (const story of visibleArticles) {
      const day = timelineDate.format(new Date(story.lead.publishedAt));
      const storiesOnDay = days.get(day);
      if (storiesOnDay) storiesOnDay.push(story);
      else days.set(day, [story]);
    }
  }

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
      <button type="button" className="choice-pill sr-only focus:not-sr-only"
        disabled={isLoading} onClick={() => void onRefresh()}>
        Feeds aktualisieren
      </button>
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

      <div role="group" aria-label="Ansicht der Startseite" className="segmented-control">
        {HOME_TABS.map(cat => (
          <button key={cat} type="button" aria-pressed={selectedCategory === cat}
            onClick={() => onSelectCategory(cat)} className="choice-pill">
            {cat}
          </button>
        ))}
      </div>

      <p className="text-sm text-[var(--muted)]">{viewDescription}</p>
      {briefing}
      {visibleArticles.length === 0 ? (
        <ViewStatus
          title={isLoading ? 'Nachrichten werden geladen …' : selectedCategory === 'Heute'
            ? 'Heute sind noch keine Meldungen verfügbar'
            : selectedCategory === 'Für dich' ? 'Keine aktuellen Empfehlungen verfügbar' : 'Keine Meldungen verfügbar'}
          action={!isLoading && selectedCategory !== 'Neueste' && (
            <button type="button" className="choice-pill" onClick={() => onSelectCategory('Neueste')}>Zu „Neueste“</button>
          )}
        />
      ) : (
        <div className="space-y-5">
          {isToday ? (
            <>
              {lead && <div><HeadlineArticleCard {...cardProps(lead)} lead />{storyDetails(lead)}</div>}
              {headlines.length > 0 && (
                <section aria-labelledby="today-headlines">
                  <h2 id="today-headlines" className="mb-3 text-xl font-bold tracking-tight">Schlagzeilen</h2>
                  <div className="grid gap-3.5 md:grid-cols-2">
                    {renderStories(headlines.slice(0, overviewCount))}
                  </div>
                </section>
              )}
              {headlines.length > overviewCount && (
                <section aria-labelledby="today-more">
                  <h2 id="today-more" className="mb-3 text-xl font-bold tracking-tight">Weitere Meldungen</h2>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {renderStories(headlines.slice(overviewCount))}
                  </div>
                </section>
              )}
            </>
          ) : isLatest ? (
            [...days].map(([day, items]) => (
              <section key={day} aria-label={day}>
                <h2 className="mb-3 text-base font-semibold text-[var(--muted)]">{day}</h2>
                <div className="grid gap-3.5 md:grid-cols-2">{renderStories(items)}</div>
              </section>
            ))
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {renderStories(visibleArticles)}
            </div>
          )}
          {stories.length > visibleLimit && <button type="button" className="choice-pill" onClick={() =>
            setBatch({ category: selectedCategory, limit: visibleLimit + 30 })}>Weitere Meldungen</button>}
        </div>
      )}
    </section>
  );
};
