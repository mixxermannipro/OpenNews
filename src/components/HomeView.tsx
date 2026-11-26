import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Headphones, Layers, LoaderCircle, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { NewsArticle, PersonalizationProfile } from '../types/news';
import type { HomeStory } from '../lib/newsFeed';
import { HOME_TABS, type HomeTab } from '../lib/preferences';
import { featuredStoryIds } from '../lib/featuredStories';
import { computePullState, PULL_REFRESH_THRESHOLD } from '../lib/pullPhysics';
import { selectHomeStarterPacks } from '../lib/feedRefresh';
import { filterUnreadStories, type ReadingProgressEntry } from '../lib/readerExtras';
import { STARTER_PACKS } from '../lib/catalog';
import { useI18n } from '../lib/i18n';
import { ViewStatus } from './ViewStatus';
import { ArticleImage } from './ArticleImage';
import { SourceIcon } from './SourceIcon';
import { CATEGORY_TEXT_STYLES, CompactArticleCard, HeadlineArticleCard, SwipeableArticleCard } from './ArticleCards';

const EDITORIAL_TOPICS: readonly NewsArticle['category'][] = [
  'Politik', 'Europa', 'Wirtschaft', 'Technologie', 'Wissenschaft', 'Gesellschaft', 'Kultur', 'Sport',
];

interface HomeViewProps {
  stories: HomeStory[];
  hasActiveSources: boolean;
  showHero: boolean;
  onOpenBriefing?: () => void;
  briefingPlaying?: boolean;
  selectedCategory: HomeTab;
  onSelectCategory: (cat: HomeTab) => void;
  profile: PersonalizationProfile;
  readingQueueIds?: string[];
  readingProgress?: Record<string, ReadingProgressEntry>;
  isLoading: boolean;
  lastUpdatedAt?: number | null;
  pendingNewCount?: number;
  onApplyPending?: () => void;
  onRefresh: (force?: boolean) => Promise<void>;
  onOpenSources: () => void;
  onApplyStarterPack: (sourceIds: readonly string[]) => void;
  onOpenArticle: (article: NewsArticle, contextList?: readonly NewsArticle[]) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleQueue?: (article: NewsArticle) => void;
  onDismissLessLikeThis?: (article: NewsArticle) => void;
  onOpenDiscover?: () => void;
}

function HomeSkeleton({ showHero }: { showHero: boolean }) {
  return (
    <div className="space-y-5" aria-hidden="true">
      {showHero && (
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          <div className="settings-group article-card overflow-hidden lg:col-span-7">
            <div className="image-shimmer aspect-[16/10] w-full" />
            <div className="space-y-3 p-4 sm:p-6">
              <div className="image-shimmer h-3 w-20 rounded-full" />
              <div className="image-shimmer h-7 w-11/12 rounded-lg" />
              <div className="image-shimmer h-7 w-3/4 rounded-lg" />
              <div className="image-shimmer h-4 w-full rounded-md" />
              <div className="pt-2 flex items-center justify-between">
                <div className="image-shimmer h-3.5 w-36 rounded-full" />
                <div className="flex gap-2">
                  <div className="image-shimmer h-8 w-8 rounded-full" />
                  <div className="image-shimmer h-8 w-8 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="settings-group overflow-hidden divide-y divide-[var(--line)] lg:col-span-5">
            {[0, 1, 2, 3].map(index => (
              <div key={index} className="flex items-start gap-3 p-4">
                <div className="image-shimmer h-4 w-5 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="image-shimmer h-3 w-16 rounded-full" />
                  <div className="image-shimmer h-4 w-full rounded-md" />
                  <div className="image-shimmer h-3 w-28 rounded-full" />
                </div>
                <div className="image-shimmer h-[62px] w-[78px] shrink-0 rounded-[10px]" />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3.5 md:grid-cols-2">
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="settings-group article-card p-3.5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="image-shimmer h-[78px] w-[78px] sm:h-[86px] sm:w-[114px] shrink-0 rounded-[14px]" />
              <div className="flex-1 space-y-2 pt-0.5">
                <div className="image-shimmer h-3 w-16 rounded-full" />
                <div className="image-shimmer h-4 w-full rounded-md" />
                <div className="image-shimmer h-4 w-5/6 rounded-md" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="image-shimmer h-3 w-32 rounded-full" />
              <div className="flex gap-2">
                <div className="image-shimmer h-7 w-7 rounded-full" />
                <div className="image-shimmer h-7 w-7 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const HomeView: React.FC<HomeViewProps> = ({
  stories,
  hasActiveSources,
  showHero,
  onOpenBriefing,
  briefingPlaying = false,
  selectedCategory,
  onSelectCategory,
  profile,
  readingQueueIds = [],
  readingProgress = {},
  isLoading,
  lastUpdatedAt,
  pendingNewCount = 0,
  onApplyPending,
  onRefresh,
  onOpenSources,
  onApplyStarterPack,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onToggleQueue,
  onDismissLessLikeThis,
  onOpenDiscover,
}) => {
  const { lang, t, homeTabLabel, categoryLabel, formatHeaderDate, formatRelative, formatTimelineDate, formatTime } = useI18n();
  const gesture = useRef<{ x: number; y: number; distance: number } | null>(null);
  const pullIndicator = useRef<HTMLDivElement>(null);
  const feedBody = useRef<HTMLDivElement>(null);
  const [gestureRefresh, setGestureRefresh] = useState(false);
  const [topicFilter, setTopicFilter] = useState<NewsArticle['category'] | 'Alle'>('Alle');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const resetPull = () => {
    gesture.current = null;
    const indicator = pullIndicator.current;
    if (indicator) {
      indicator.style.removeProperty('--pull-distance');
      indicator.style.removeProperty('--pull-progress');
      delete indicator.dataset.pulling;
      delete indicator.dataset.visible;
      delete indicator.dataset.ready;
    }
    const body = feedBody.current;
    if (body) {
      body.style.removeProperty('--feed-pull-y');
      delete body.dataset.pulling;
    }
  };

  const quickPacks = useMemo(
    () => selectHomeStarterPacks(STARTER_PACKS, lang, 4),
    [lang],
  );

  const isToday = selectedCategory === 'Heute';
  const isLatest = selectedCategory === 'Neueste';

  const readSet = useMemo(() => new Set(profile.readIds), [profile.readIds]);
  const queueSet = useMemo(() => new Set(readingQueueIds), [readingQueueIds]);

  const availableTopics = useMemo(() => {
    if (!isToday) return [];
    const present = new Set(stories.map(story => story.lead.category));
    return EDITORIAL_TOPICS.filter(topic => present.has(topic));
  }, [isToday, stories]);

  const activeTopic = isToday && topicFilter !== 'Alle' && availableTopics.includes(topicFilter)
    ? topicFilter
    : 'Alle';

  const topicStories = useMemo(() => {
    if (!isToday || activeTopic === 'Alle') return stories;
    return stories.filter(story => story.lead.category === activeTopic);
  }, [isToday, activeTopic, stories]);

  const readCountInScope = useMemo(
    () => topicStories.reduce((count, story) => count + (readSet.has(story.lead.id) ? 1 : 0), 0),
    [topicStories, readSet],
  );
  const unreadCountInScope = topicStories.length - readCountInScope;

  const filteredStories = useMemo(
    () => filterUnreadStories(topicStories, readSet, unreadOnly),
    [topicStories, readSet, unreadOnly],
  );

  const batchKey = `${selectedCategory}:${activeTopic}:${unreadOnly ? 'unread' : 'all'}`;
  const [batch, setBatch] = useState({ key: batchKey, limit: 20 });
  const visibleLimit = batch.key === batchKey ? batch.limit : 20;
  const visibleArticles = filteredStories.slice(0, visibleLimit);
  const readerContextList = useMemo(
    () => filteredStories.slice(0, Math.max(visibleLimit, 36)).map(story => story.lead),
    [filteredStories, visibleLimit],
  );

  const openFromFeed = useCallback(
    (article: NewsArticle) => onOpenArticle(article, readerContextList),
    [onOpenArticle, readerContextList],
  );

  const lead = isToday && showHero ? visibleArticles[0] : undefined;
  const headlines = visibleArticles.slice(lead ? 1 : 0);
  const hasFocusColumn = Boolean(isToday && lead && headlines.length >= 3);
  const focusCount = headlines.length >= 5 ? 5 : 4;
  const focusStories = hasFocusColumn ? headlines.slice(0, focusCount) : [];
  const streamStories = hasFocusColumn ? headlines.slice(focusCount) : headlines;

  const featured = useMemo(() => {
    if (!showHero || isLatest) return new Set<string>();
    if (isToday) {
      // Avoid stacking a wide card directly under the front-page broadsheet split
      return featuredStoryIds(hasFocusColumn ? streamStories.slice(2) : streamStories, { featureLead: false });
    }
    return featuredStoryIds(visibleArticles, { featureLead: selectedCategory === 'Für dich' });
  }, [showHero, isLatest, isToday, hasFocusColumn, streamStories, visibleArticles, selectedCategory]);

  const viewDescription = isToday
    ? t('homeDescToday')
    : selectedCategory === 'Für dich'
      ? t('homeDescForYou')
      : t('homeDescLatest');

  const canSwipeDismiss = Boolean(onDismissLessLikeThis) && (isToday || selectedCategory === 'Für dich');

  const bookmarkedSet = useMemo(() => new Set(profile.bookmarkedIds), [profile.bookmarkedIds]);
  const likedSet = useMemo(() => new Set(profile.likedIds), [profile.likedIds]);

  const cardProps = ({ lead: article }: HomeStory) => ({
    article,
    isBookmarked: bookmarkedSet.has(article.id),
    isLiked: likedSet.has(article.id),
    inQueue: queueSet.has(article.id),
    isRead: readSet.has(article.id),
    readingProgress: readingProgress[article.id]?.ratio,
    onOpen: openFromFeed,
    onToggleBookmark,
    onToggleLike,
    onToggleQueue,
    onDismissLessLikeThis: canSwipeDismiss ? onDismissLessLikeThis : undefined,
  });

  const uniqueSourcesOf = (reports: NewsArticle[]) => {
    const seen = new Set<string>();
    const list: NewsArticle[] = [];
    for (const report of reports) {
      if (!seen.has(report.sourceId)) {
        seen.add(report.sourceId);
        list.push(report);
      }
    }
    return list;
  };

  const related = ({ reports }: HomeStory) => {
    if (reports.length < 2) return null;
    const distinctSources = uniqueSourcesOf(reports);
    const otherSources = [...new Set(reports.slice(1).map(report => report.sourceName))];
    const totalSources = distinctSources.length;
    const summaryLabel = totalSources > 1
      ? t('homeSourcesReport', { count: totalSources })
      : t('homeMoreReports');
    return (
      <details className="cluster-disclosure mt-1.5 min-w-0 overflow-hidden rounded-[calc(var(--card-radius)*0.72)] border border-[var(--line)] bg-[var(--panel)] px-3.5 py-1 text-sm">
        <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center justify-between gap-2.5 text-xs font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            {totalSources > 1 && (
              <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                {distinctSources.slice(0, 3).map(report => (
                  <span key={report.sourceId} className="inline-flex rounded-[5px] ring-2 ring-[var(--panel)]">
                    <SourceIcon
                      source={{ id: report.sourceId, shortCode: report.sourceShortCode, accentColor: report.sourceColor }}
                      size="h-4 w-4 rounded-[4px] text-[6.5px]"
                    />
                  </span>
                ))}
              </span>
            )}
            <span className="min-w-0 truncate">
              {summaryLabel}
              {otherSources.length > 0 && (
                <span className="font-normal text-[var(--muted)]"> · {otherSources.slice(0, 3).join(', ')}</span>
              )}
            </span>
          </span>
          <ChevronDown size={15} className="cluster-chevron shrink-0 text-[var(--muted)]" aria-hidden="true" />
        </summary>
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)] pb-1">
          {reports.slice(1).map(report => (
            <li key={report.id}>
              <button
                className="flex min-h-11 w-full flex-col justify-center gap-0.5 py-2 text-left transition-colors hover:text-[var(--accent)]"
                type="button"
                onClick={() => openFromFeed(report)}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                  <SourceIcon
                    source={{ id: report.sourceId, shortCode: report.sourceShortCode, accentColor: report.sourceColor }}
                    size="h-3.5 w-3.5 rounded-[3px] text-[6px]"
                  />
                  <span>{report.sourceName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-normal">{formatRelative(report.publishedAt)}</span>
                </span>
                <span className="text-[13.5px] font-medium leading-snug text-[var(--ink)]">{report.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    );
  };

  const storyDetails = (story: HomeStory) => {
    const hasCluster = story.reports.length >= 2;
    const showReason = Boolean(story.reason) && !(hasCluster && story.reason === 'Von mehreren Quellen berichtet');
    if (!showReason && !hasCluster) return null;
    return (
      <div className="space-y-1">
        {showReason && <p className="px-2 pt-1.5 text-xs font-medium text-[var(--muted)]">{story.reason}</p>}
        {related(story)}
      </div>
    );
  };

  const renderStories = (items: HomeStory[]) => items.map(story => {
    const large = featured.has(story.lead.id);
    const Card = large ? HeadlineArticleCard : CompactArticleCard;
    return (
      <div key={story.lead.id} className={large ? 'min-w-0 md:col-span-2' : 'min-w-0'}>
        <SwipeableArticleCard article={story.lead} enabled={canSwipeDismiss} onDismiss={onDismissLessLikeThis}>
          <Card {...cardProps(story)} />
        </SwipeableArticleCard>
        {storyDetails(story)}
      </div>
    );
  });

  const days = new Map<string, HomeStory[]>();
  if (isLatest) {
    for (const story of visibleArticles) {
      const day = formatTimelineDate(new Date(story.lead.publishedAt));
      const storiesOnDay = days.get(day);
      if (storiesOnDay) storiesOnDay.push(story);
      else days.set(day, [story]);
    }
  }

  return (
    <section
      aria-label={t('homeAria')}
      className="screen-entry space-y-5"
      onTouchStart={event => {
        if (!hasActiveSources || window.scrollY > 1 || isLoading || gestureRefresh || event.touches.length !== 1) return;
        const { clientX, clientY } = event.touches[0];
        gesture.current = { x: clientX, y: clientY, distance: 0 };
        pullIndicator.current?.setAttribute('data-pulling', '');
        feedBody.current?.setAttribute('data-pulling', '');
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
        const pull = computePullState(start.distance, PULL_REFRESH_THRESHOLD);
        const indicator = pullIndicator.current;
        if (indicator) {
          indicator.toggleAttribute('data-visible', pull.distance > 0);
          indicator.toggleAttribute('data-ready', pull.ready);
          indicator.style.setProperty('--pull-distance', `${pull.indicatorOffset}px`);
          indicator.style.setProperty('--pull-progress', String(pull.progress));
        }
        const body = feedBody.current;
        if (body) {
          body.style.setProperty('--feed-pull-y', `${pull.contentShift}px`);
        }
      }}
      onTouchEnd={() => {
        const shouldRefresh = (gesture.current?.distance ?? 0) >= PULL_REFRESH_THRESHOLD;
        resetPull();
        if (shouldRefresh && !isLoading && hasActiveSources) {
          setGestureRefresh(true);
          void Promise.resolve(onRefresh(true)).finally(() => setGestureRefresh(false));
        }
      }}
      onTouchCancel={resetPull}
    >
      <div className="relative">
        <p className="sr-only" role="status">
          {gestureRefresh || isLoading ? t('refreshing') : ''}
        </p>
        <div
          ref={pullIndicator}
          className="pull-indicator"
          data-refreshing={gestureRefresh}
          aria-hidden="true"
        >
          {gestureRefresh ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowDown size={17} />}
        </div>

        <div ref={feedBody} className="pull-content space-y-4 sm:space-y-5">
          <div className="screen-heading items-end gap-y-2.5">
            <div className="min-w-0">
              <h1>{t('homeTitle')}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 tabular-nums">
                <span>{formatHeaderDate(new Date())}</span>
                {lastUpdatedAt && !isLoading && hasActiveSources && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t('homeUpdatedAt', { time: formatTime(lastUpdatedAt) })}</span>
                  </>
                )}
              </p>
            </div>
            {hasActiveSources && (
              <div className="home-header-actions">
                <div
                  role="group"
                  aria-label={t('homeTabsAria')}
                  className="segmented-control sliding-tabs home-segmented"
                  style={{ '--tab-count': HOME_TABS.length, '--tab-index': HOME_TABS.indexOf(selectedCategory) } as React.CSSProperties}
                >
                  <span className="tab-track" aria-hidden="true"><span className="tab-selection" /></span>
                  {HOME_TABS.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={selectedCategory === cat}
                      onClick={() => {
                        onSelectCategory(cat);
                        if (cat !== 'Heute') setTopicFilter('Alle');
                      }}
                      className="choice-pill whitespace-nowrap"
                    >
                      {homeTabLabel(cat)}
                    </button>
                  ))}
                </div>
                <div className="home-action-buttons flex shrink-0 items-center gap-1">
                  {onOpenBriefing && (
                    <button
                      className="briefing-trigger rounded-full px-2.5"
                      type="button"
                      aria-haspopup="dialog"
                      onClick={onOpenBriefing}
                    >
                      <Headphones size={16} className={briefingPlaying ? 'text-[var(--accent)]' : undefined} aria-hidden="true" />
                      <span>{t('briefingTrigger')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="briefing-trigger rounded-full px-2.5"
                    disabled={isLoading}
                    onClick={() => void onRefresh(true)}
                    aria-label={t('refresh')}
                    title={t('refresh')}
                  >
                    <RefreshCw
                      size={16}
                      className={isLoading ? 'animate-spin text-[var(--accent)]' : undefined}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {!hasActiveSources ? (
            <div className="settings-group space-y-6 p-6 sm:p-8">
              <div className="max-w-xl space-y-2.5">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--control)] text-[var(--accent)]">
                  <Layers className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
                  {t('homeNoSourcesTitle')}
                </h2>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {t('homeNoSourcesDesc')}
                </p>
              </div>

              <div>
                <button type="button" className="primary-action px-6" onClick={onOpenSources}>
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  {t('homeChooseSources')}
                </button>
              </div>

              <div className="space-y-3 border-t border-[var(--line)] pt-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                  <span>{t('homeStarterPacksHint')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {quickPacks.map(pack => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => onApplyStarterPack(pack.sourceIds)}
                      className="source-pack-card article-card-interactive flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--ink)]">{pack.label}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{pack.subtitle}</p>
                      </div>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--control)] text-[var(--ink)]">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {isToday && availableTopics.length >= 2 ? (
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]">
                    <div
                      role="group"
                      aria-label={t('sourcesCatAll')}
                      className="no-scrollbar topic-rail-fade -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 pr-6"
                    >
                      {(['Alle', ...availableTopics] as const).map(topic => {
                        const active = activeTopic === topic;
                        return (
                          <button
                            key={topic}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setTopicFilter(topic)}
                            className={`relative inline-flex min-h-11 shrink-0 items-center px-2.5 text-[13.5px] whitespace-nowrap transition-colors ${
                              active
                                ? 'font-bold text-[var(--ink)]'
                                : 'font-medium text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {topic === 'Alle' ? t('all') : categoryLabel(topic)}
                            {active && (
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--accent)]"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {(readCountInScope > 0 || unreadOnly) && (
                      <button
                        type="button"
                        aria-pressed={unreadOnly}
                        onClick={() => setUnreadOnly(prev => !prev)}
                        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-xs font-semibold tabular-nums transition-colors ${
                          unreadOnly
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span>{t('homeUnreadOnly')}</span>
                        <span className="opacity-75">{unreadCountInScope}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-[var(--muted)]">{viewDescription}</p>
                    {(readCountInScope > 0 || unreadOnly) && (
                      <button
                        type="button"
                        aria-pressed={unreadOnly}
                        onClick={() => setUnreadOnly(prev => !prev)}
                        className="choice-pill shrink-0 whitespace-nowrap text-xs tabular-nums"
                      >
                        {t('homeUnreadOnly')} · {unreadCountInScope}
                      </button>
                    )}
                  </div>
                )}
                {isLoading && visibleArticles.length > 0 && (
                  <div className="feed-progress-track" role="progressbar" aria-label={t('refreshing')}>
                    <div className="feed-progress-bar" />
                  </div>
                )}
              </div>

              {pendingNewCount > 0 && onApplyPending && (
                <div className="sticky top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex justify-center pointer-events-none">
                  <button
                    type="button"
                    onClick={onApplyPending}
                    className="liquid-glass-dock pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-lg transition active:scale-95"
                  >
                    <ArrowUp size={15} className="text-[var(--accent)]" aria-hidden="true" />
                    {pendingNewCount === 1
                      ? t('homeNewOne')
                      : t('homeNewMany', { count: pendingNewCount })}
                  </button>
                </div>
              )}

              {visibleArticles.length === 0 ? (
                isLoading ? (
                  <div className="space-y-4">
                    <p role="status" className="sr-only">{t('loadingArticles')}</p>
                    <HomeSkeleton showHero={isToday && showHero} />
                  </div>
                ) : unreadOnly && topicStories.length > 0 ? (
                  <ViewStatus
                    title={t('homeAllReadTitle')}
                    action={(
                      <button type="button" className="choice-pill" onClick={() => setUnreadOnly(false)}>
                        {t('homeShowAll')}
                      </button>
                    )}
                  />
                ) : (
                  <ViewStatus
                    title={selectedCategory === 'Heute'
                      ? t('homeNoToday')
                      : selectedCategory === 'Für dich' ? t('homeNoForYou') : t('homeNoLatest')}
                    action={selectedCategory !== 'Neueste' ? (
                      <button type="button" className="choice-pill" onClick={() => onSelectCategory('Neueste')}>{t('homeGoLatest')}</button>
                    ) : (
                      <button type="button" className="choice-pill" onClick={() => void onRefresh(true)}>{t('retry')}</button>
                    )}
                  />
                )
              ) : (
                <div className="feed-content space-y-6" key={batchKey}>
                  {isToday ? (
                    <>
                      {lead && (
                        <div className={hasFocusColumn ? 'grid gap-5 lg:grid-cols-12 lg:items-start' : undefined}>
                          <div className={hasFocusColumn ? 'min-w-0 lg:col-span-7' : 'min-w-0'}>
                            <SwipeableArticleCard article={lead.lead} enabled={canSwipeDismiss} onDismiss={onDismissLessLikeThis}>
                              <HeadlineArticleCard {...cardProps(lead)} lead />
                            </SwipeableArticleCard>
                            {storyDetails(lead)}
                          </div>

                          {hasFocusColumn && (
                            <section
                              aria-labelledby="today-headlines"
                              className="settings-group article-card min-w-0 overflow-hidden lg:col-span-5"
                            >
                              <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
                                <h2
                                  id="today-headlines"
                                  className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--muted)]"
                                >
                                  {t('homeHeadlines')}
                                </h2>
                                <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                                  02 – 0{focusStories.length + 1}
                                </span>
                              </div>
                              <ol className="divide-y divide-[var(--line)]">
                                {focusStories.map((story, idx) => {
                                  const article = story.lead;
                                  const distinctSources = uniqueSourcesOf(story.reports);
                                  const isRowRead = readSet.has(article.id);
                                  const rowRatio = readingProgress[article.id]?.ratio;
                                  const rowPct = rowRatio && rowRatio >= 0.12 && rowRatio < 0.92 ? Math.round(rowRatio * 100) : 0;
                                  const categoryColor = article.isBreaking
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : (CATEGORY_TEXT_STYLES[article.category] || 'text-[var(--accent)]');
                                  return (
                                    <li key={article.id}>
                                      <button
                                        type="button"
                                        onClick={() => openFromFeed(article)}
                                        className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--control)]/55 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
                                      >
                                        <span className="w-5 shrink-0 pt-0.5 text-xs font-bold tabular-nums text-[var(--muted)]/80">
                                          0{idx + 2}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span className={`text-[11px] font-bold tracking-wide ${categoryColor}`}>
                                              {article.isBreaking
                                                ? `${t('breaking')} · ${categoryLabel(article.category)}`
                                                : categoryLabel(article.category)}
                                            </span>
                                            {distinctSources.length > 1 && (
                                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                                                <span className="flex -space-x-1" aria-hidden="true">
                                                  {distinctSources.slice(0, 3).map(src => (
                                                    <span key={src.sourceId} className="inline-flex rounded-[4px] ring-1 ring-[var(--panel)]">
                                                      <SourceIcon
                                                        source={{ id: src.sourceId, shortCode: src.sourceShortCode, accentColor: src.sourceColor }}
                                                        size="h-3.5 w-3.5 rounded-[3px] text-[6px]"
                                                      />
                                                    </span>
                                                  ))}
                                                </span>
                                                <span>+{distinctSources.length - 1}</span>
                                              </span>
                                            )}
                                          </div>
                                          <h3 className={`mt-1 line-clamp-2 [overflow-wrap:anywhere] text-[14.5px] font-bold leading-[1.3] tracking-[-0.015em] [text-wrap:balance] transition-opacity [@media(hover:hover)]:group-hover:opacity-80 ${
                                            isRowRead && !rowPct ? 'text-[var(--ink)]/70' : 'text-[var(--ink)]'
                                          }`}>
                                            {article.title}
                                          </h3>
                                          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[var(--muted)] tabular-nums">
                                            <SourceIcon
                                              source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
                                              size="h-3.5 w-3.5 rounded-[3px] text-[6px]"
                                            />
                                            <span className="truncate font-medium text-[var(--ink)]/85">{article.sourceName}</span>
                                            <span aria-hidden="true">·</span>
                                            <span className="whitespace-nowrap">{formatRelative(article.publishedAt)}</span>
                                            {rowPct > 0 ? (
                                              <span className="whitespace-nowrap font-semibold text-[var(--accent)]">
                                                <span aria-hidden="true">· </span>
                                                {rowPct}%
                                              </span>
                                            ) : isRowRead ? (
                                              <span className="hidden sm:inline whitespace-nowrap">
                                                <span aria-hidden="true">· </span>
                                                {t('readLabel')}
                                              </span>
                                            ) : article.readingTimeMin > 0 ? (
                                              <span className="hidden sm:inline whitespace-nowrap">
                                                <span aria-hidden="true">· </span>
                                                {t('briefingReadMin', { min: article.readingTimeMin })}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {article.imageUrl && (
                                          <div className="article-thumbnail h-[66px] w-[84px] shrink-0 overflow-hidden rounded-[10px] bg-[var(--control)]">
                                            <ArticleImage
                                              src={article.imageUrl}
                                              alt=""
                                              sourceShortCode={article.sourceShortCode}
                                              sourceColor={article.sourceColor}
                                              className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                                            />
                                          </div>
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            </section>
                          )}
                        </div>
                      )}

                      {streamStories.length > 0 && (
                        <section aria-labelledby="today-more">
                          <h2 id="today-more" className="mb-3 text-xl font-bold tracking-tight">
                            {hasFocusColumn ? t('homeMore') : t('homeHeadlines')}
                          </h2>
                          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                            {renderStories(streamStories)}
                          </div>
                        </section>
                      )}
                    </>
                  ) : isLatest ? (
                    [...days].map(([day, items]) => (
                      <section key={day} aria-label={day}>
                        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)]">{day}</h2>
                        <div className="grid gap-3.5 md:grid-cols-2">{renderStories(items)}</div>
                      </section>
                    ))
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {renderStories(visibleArticles)}
                    </div>
                  )}
                  {filteredStories.length > visibleLimit ? (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        className="choice-pill px-6"
                        onClick={() => setBatch({ key: batchKey, limit: visibleLimit + 24 })}
                      >
                        {t('homeShowMore')}
                      </button>
                    </div>
                  ) : isToday && visibleArticles.length > 0 ? (
                    <div className="flex flex-col items-center gap-2 border-t border-[var(--line)] pt-7 pb-3 text-center">
                      <CheckCircle2 size={22} className="text-[var(--accent)]" aria-hidden="true" />
                      <p className="text-sm font-bold text-[var(--ink)]">{t('feedCaughtUpTitle')}</p>
                      <p className="text-xs text-[var(--muted)]">{t('feedCaughtUpHint')}</p>
                      {onOpenDiscover && (
                        <button type="button" className="choice-pill mt-1 text-xs" onClick={onOpenDiscover}>
                          {t('navDiscover')}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
