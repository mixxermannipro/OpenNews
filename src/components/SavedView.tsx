import { hasCloudAI } from '../lib/aiClient';
import { WeeklyReview } from './WeeklyReview';
import { selectWeeklyArticles, reviewWeek } from '../lib/weeklyReview';
import { ViewStatus } from './ViewStatus';
import { distinctArticles } from '../lib/newsFeed';
import { estimateQueueMinutes, exportHighlightsMarkdown, type ArticleHighlight, type ReadingProgressEntry } from '../lib/readerExtras';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Sparkles, Trash2 } from 'lucide-react';
import type { AIProviderConfig, NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { useI18n } from '../lib/i18n';
import { safeHref } from '../lib/contentIdentity';
import { CompactArticleCard } from './ArticleCards';

interface SavedViewProps {
  aiConfig: AIProviderConfig;
  initialPage: 'bookmarks' | 'history';
  history: NewsArticle[];
  articles: NewsArticle[];
  queueArticles: NewsArticle[];
  readingQueueIds?: string[];
  readingProgress?: Record<string, ReadingProgressEntry>;
  highlights: ArticleHighlight[];
  sources: NewsSource[];
  profile: PersonalizationProfile;
  onOpenArticle: (article: NewsArticle, contextList?: readonly NewsArticle[]) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleQueue?: (article: NewsArticle) => void;
  onRemoveFromQueue: (articleId: string) => void;
  onRemoveHighlight: (id: string) => void;
  onClearHistory: () => Promise<void>;
  onBack?: () => void;
}

const SAVED_TAB_IDS = ['bookmarks', 'queue', 'quotes', 'likes', 'history', 'algorithm'] as const;
type SavedSubTab = (typeof SAVED_TAB_IDS)[number];

export const SavedView: React.FC<SavedViewProps> = ({
  aiConfig,
  initialPage,
  history,
  articles,
  queueArticles,
  readingQueueIds = [],
  readingProgress = {},
  highlights,
  sources,
  profile,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onToggleQueue,
  onRemoveFromQueue,
  onRemoveHighlight,
  onClearHistory,
  onBack,
}) => {
  const { t, categoryLabel } = useI18n();
  const bookmarkedSet = useMemo(() => new Set(profile.bookmarkedIds), [profile.bookmarkedIds]);
  const likedSet = useMemo(() => new Set(profile.likedIds), [profile.likedIds]);
  const queueSet = useMemo(() => new Set(readingQueueIds), [readingQueueIds]);
  const readSet = useMemo(() => new Set(profile.readIds), [profile.readIds]);
  const [subTab, setSubTab] = useState<SavedSubTab>(initialPage);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearStatus, setClearStatus] = useState('');
  const [copiedQuotes, setCopiedQuotes] = useState(false);
  const copyTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const tabs = [
    { id: 'bookmarks' as const, label: t('savedTabBookmarks') },
    { id: 'queue' as const, label: `${t('savedTabQueue')}${queueArticles.length ? ` (${queueArticles.length})` : ''}` },
    { id: 'quotes' as const, label: `${t('savedTabQuotes')}${highlights.length ? ` (${highlights.length})` : ''}` },
    { id: 'likes' as const, label: t('savedTabLikes') },
    { id: 'history' as const, label: t('savedTabHistory') },
    { id: 'algorithm' as const, label: t('savedTabProfile') },
  ];

  const clearHistory = async () => {
    try {
      await onClearHistory();
      setConfirmClear(false);
      setClearStatus(t('savedCleared'));
    } catch {
      setConfirmClear(false);
      setClearStatus(t('savedClearError'));
    }
  };

  const handleCopyMarkdown = async () => {
    if (!highlights.length) return;
    try {
      await navigator.clipboard.writeText(exportHighlightsMarkdown(highlights));
      setCopiedQuotes(true);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedQuotes(false), 2200);
    } catch {
      // Clipboard unavailable
    }
  };

  const { week, weeklyArticles } = useMemo(() => {
    const current = new Date();
    return {
      week: reviewWeek(current),
      weeklyArticles: selectWeeklyArticles(articles, profile, current.getTime()),
    };
  }, [articles, profile]);

  const bookmarkedArticles = useMemo(
    () => distinctArticles(articles.filter((a) => bookmarkedSet.has(a.id))),
    [articles, bookmarkedSet]
  );

  const likedArticles = useMemo(
    () => distinctArticles(articles.filter((a) => likedSet.has(a.id))),
    [articles, likedSet]
  );

  const topTopics = useMemo(
    () =>
      Object.entries(profile.topicWeights)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1]),
    [profile.topicWeights]
  );

  const topSources = useMemo(
    () =>
      Object.entries(profile.sourceWeights)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, w]) => ({
          id,
          name: sources.find((s) => s.id === id)?.name || id,
          weight: w,
        })),
    [profile.sourceWeights, sources]
  );

  const activeList = subTab === 'history' ? history : subTab === 'bookmarks' ? bookmarkedArticles : likedArticles;
  const queueTotalMinutes = estimateQueueMinutes(queueArticles);

  return (
    <section aria-label={t('savedTitle')} className="screen-entry space-y-5">
      <div className="space-y-2">
        {onBack && (
          <button className="choice-pill inline-flex items-center gap-2" onClick={onBack} type="button">
            <ArrowLeft size={16} aria-hidden="true" /> {t('back')}
          </button>
        )}
        <div>
          <h1 className="screen-title">
            {subTab === 'history'
              ? t('savedHistoryTitle')
              : subTab === 'algorithm'
                ? t('savedAlgoTitle')
                : subTab === 'queue'
                  ? t('savedTabQueue')
                  : subTab === 'quotes'
                    ? t('savedTabQuotes')
                    : t('savedTitle')}
          </h1>
          <p className="screen-subtitle">
            {t('savedSubtitle')}
          </p>
        </div>
      </div>

      {/* Scroll-safe horizontal tabs so 6 tabs never clip on 344px foldables or phones */}
      <div
        role="group"
        aria-label={t('savedTitle')}
        className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className="choice-pill shrink-0 whitespace-nowrap"
            aria-pressed={subTab === tab.id}
            onClick={() => { setSubTab(tab.id); setConfirmClear(false); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="feed-content space-y-5" key={subTab}>
        {(subTab === 'bookmarks' || subTab === 'likes') && hasCloudAI(aiConfig) &&
          weeklyArticles.length >= 2 && (
            <WeeklyReview
              key={JSON.stringify([week, weeklyArticles.map(article => article.id), aiConfig.provider, aiConfig.model])}
              articles={weeklyArticles}
              config={aiConfig}
              week={week}
            />
          )}

        {subTab === 'history' && (
          <div className="space-y-2">
            {!confirmClear ? (
              <button type="button" className="choice-pill" onClick={() => setConfirmClear(true)}>
                {t('savedClearHistory')}
              </button>
            ) : (
              <div className="settings-group flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm font-medium text-[var(--ink)]">
                  {t('savedClearConfirm')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="choice-pill" onClick={() => setConfirmClear(false)}>
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    className="choice-pill bg-rose-600 text-white border-transparent hover:bg-rose-500"
                    onClick={() => void clearHistory()}
                  >
                    {t('savedClearNow')}
                  </button>
                </div>
              </div>
            )}
            {clearStatus && <p role="status" className="text-sm text-[var(--muted)]">{clearStatus}</p>}
          </div>
        )}

        {subTab === 'queue' ? (
          queueArticles.length === 0 ? (
            <ViewStatus title={t('savedQueueEmpty')}>
              {t('savedQueueEmptyHint')}
            </ViewStatus>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[var(--muted)] tabular-nums">
                {t('savedQueueSummary', { count: queueArticles.length, min: queueTotalMinutes })}
              </p>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {queueArticles.map(article => (
                  <div key={article.id} className="space-y-1.5">
                    <CompactArticleCard
                      article={article}
                      isBookmarked={bookmarkedSet.has(article.id)}
                      isLiked={likedSet.has(article.id)}
                      inQueue={queueSet.has(article.id)}
                      isRead={readSet.has(article.id)}
                      readingProgress={readingProgress[article.id]?.ratio}
                      onOpen={a => onOpenArticle(a, queueArticles)}
                      onToggleBookmark={onToggleBookmark}
                      onToggleLike={onToggleLike}
                      onToggleQueue={onToggleQueue}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(article.id)}
                      className="inline-flex min-h-9 items-center gap-1 px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t('sourcesDelete')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : subTab === 'quotes' ? (
          highlights.length === 0 ? (
            <ViewStatus title={t('savedQuotesEmpty')}>
              {t('savedQuotesEmptyHint')}
            </ViewStatus>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="choice-pill inline-flex items-center gap-2"
                  onClick={() => void handleCopyMarkdown()}
                >
                  <Copy size={15} aria-hidden="true" />
                  {copiedQuotes ? t('savedExportCopied') : t('savedExportMarkdown')}
                </button>
              </div>
              <ul className="space-y-3">
                {highlights.map(item => (
                  <li key={item.id} className="settings-group p-4 space-y-2">
                    <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-[15px] leading-relaxed text-[var(--ink)] font-editorial-serif">
                      „{item.quote}“
                    </blockquote>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {safeHref(item.articleLink) ? (
                        <a
                          href={safeHref(item.articleLink)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <span className="font-semibold text-[var(--ink)]">{item.sourceName}</span> · {item.articleTitle}
                        </a>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--muted)]">
                          <span className="font-semibold text-[var(--ink)]">{item.sourceName}</span> · {item.articleTitle}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveHighlight(item.id)}
                        aria-label={t('sourcesDelete')}
                        className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : subTab === 'algorithm' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="settings-group p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                  {t('savedLearnedTopics')}
                </div>
                <span className="text-xs font-medium text-[var(--muted)] tabular-nums">
                  {t('savedReadingTime')}: {Math.floor((profile.totalReadingSeconds || 0) / 60)}m {(profile.totalReadingSeconds || 0) % 60}s
                </span>
              </div>
              {topTopics.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t('savedNoLikesHint')}</p>
              ) : (
                <div className="space-y-3">
                  {topTopics.map(([topic, weight]) => {
                    const secs = profile.readingSecondsByTopic?.[topic] ?? 0;
                    return (
                      <div key={topic} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[var(--ink)]">{categoryLabel(topic)}</span>
                          <span className="tabular-nums text-[var(--muted)]">
                            +{weight.toFixed(1)} · {secs > 0 ? `${Math.round(secs)}s` : t('savedTabLikes')}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--control)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                            style={{ width: `${Math.min(100, weight * 10)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="settings-group p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--ink)]">
                  {t('savedPreferredSources')}
                </span>
              </div>
              {topSources.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t('settingsPrivacyNote1')}</p>
              ) : (
                <div className="space-y-2.5">
                  {topSources.map((src) => {
                    const secs = profile.readingSecondsBySource?.[src.id] ?? 0;
                    return (
                      <div key={src.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--ink)]">{src.name}</span>
                        <span className="tabular-nums font-semibold text-[var(--accent)]">
                          +{src.weight.toFixed(1)} · {secs > 0 ? `${Math.round(secs)}s` : t('savedTabLikes')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeList.length === 0 ? (
          <ViewStatus title={subTab === 'history' ? t('savedNoHistory') : subTab === 'bookmarks' ? t('savedNoBookmarks') : t('savedNoLikes')}>
            {subTab === 'history' ? t('savedNoHistoryHint') : subTab === 'bookmarks'
              ? t('savedNoBookmarksHint')
              : t('savedNoLikesHint')}
          </ViewStatus>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {activeList.map((article) => (
              <CompactArticleCard
                key={article.id}
                article={article}
                isBookmarked={profile.bookmarkedIds.includes(article.id)}
                isLiked={profile.likedIds.includes(article.id)}
                inQueue={queueSet.has(article.id)}
                isRead={subTab !== 'history' && readSet.has(article.id)}
                readingProgress={readingProgress[article.id]?.ratio}
                onOpen={a => onOpenArticle(a, activeList)}
                onToggleBookmark={onToggleBookmark}
                onToggleLike={onToggleLike}
                onToggleQueue={onToggleQueue}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
