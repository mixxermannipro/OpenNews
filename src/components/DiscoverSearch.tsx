import React, { useMemo, useState } from 'react';
import { Check, Film, Plus, Radar, Search, X } from 'lucide-react';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getDiscoverCopy } from '../lib/discoverCopy';
import {
  extractLiveSearchSuggestions,
  searchDiscoverArticles,
  type DiscoverSort,
} from '../lib/discoverEngine';
import { searchAndFilterSources } from '../lib/sourceSearch';
import { useI18n } from '../lib/i18n';
import { CompactArticleCard } from './ArticleCards';
import { SourceIcon } from './SourceIcon';
import { ViewStatus } from './ViewStatus';

interface DiscoverSearchProps {
  articles: NewsArticle[];
  sources: NewsSource[];
  query: string;
  onQuery: (query: string) => void;
  onToggleSubscribe: (id: string) => void;
  trackedKeywords?: string[];
  onAddTrackedKeyword?: (keyword: string) => void;
  radarToggle?: React.ReactNode;
  profile: PersonalizationProfile;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

export const DiscoverSearch: React.FC<DiscoverSearchProps> = ({
  articles,
  sources,
  query,
  onQuery: setQuery,
  onToggleSubscribe,
  trackedKeywords = [],
  onAddTrackedKeyword,
  radarToggle,
  profile,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
}) => {
  const { lang, locale, t, categoryLabel } = useI18n();
  const copy = getDiscoverCopy(lang);
  const [recent, setRecent] = useLocalStorage<string[]>('opennews_recent_searches', []);
  const [sort, setSort] = useState<DiscoverSort>('relevance');
  const [mediaOnly, setMediaOnly] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(20);

  const remember = (value: string) => {
    const term = value.trim();
    if (term) {
      setRecent(previous =>
        [term, ...previous.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 6),
      );
    }
  };

  const term = query.trim();

  const results = useMemo(
    () => (term ? searchDiscoverArticles(articles, term, { sort, mediaOnly }) : []),
    [articles, term, sort, mediaOnly],
  );

  const matchingSources = useMemo(
    () => (term ? searchAndFilterSources(sources, { query: term, locale }).slice(0, 8) : []),
    [sources, term, locale],
  );

  const liveSuggestions = useMemo(
    () => extractLiveSearchSuggestions(articles, lang, 6),
    [articles, lang],
  );

  const isAlreadyTracked = useMemo(
    () => Boolean(term && trackedKeywords.some(k => k.toLowerCase() === term.toLowerCase())),
    [term, trackedKeywords],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <form
          className="relative min-w-0 flex-1"
          role="search"
          onSubmit={event => {
            event.preventDefault();
            remember(query);
            event.currentTarget.querySelector('input')?.blur();
          }}
        >
          <Search
            className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleLimit(20);
            }}
            placeholder={t('discoverSearchPlaceholder')}
            aria-label={t('discoverSearchPlaceholder')}
            className={`preference-input discover-search-input w-full rounded-full text-sm text-[var(--ink)] placeholder:text-[var(--muted)] ${query ? 'pr-12' : ''}`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setMediaOnly(false);
              }}
              aria-label={t('clear')}
              className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </form>
        {radarToggle}
      </div>

      {/* Recent searches (only when search box is empty) */}
      {!term && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t('discoverRecent')}:
          </span>
          {recent.map(savedTerm => (
            <button
              key={savedTerm}
              type="button"
              className="choice-pill min-h-9 px-3 text-xs"
              onClick={() => {
                setQuery(savedTerm);
                remember(savedTerm);
              }}
            >
              {savedTerm}
            </button>
          ))}
          <button
            type="button"
            className="min-h-9 px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={() => setRecent([])}
          >
            {t('discoverClearRecent')}
          </button>
        </div>
      )}

      {/* Live Trending Entities from today's feed (never duplicates Ressort category names) */}
      {!term && liveSuggestions.length > 0 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {copy.liveTopicsLabel}:
          </span>
          {liveSuggestions.map((suggested) => (
            <button
              key={suggested}
              type="button"
              onClick={() => {
                setQuery(suggested);
                remember(suggested);
              }}
              className="choice-pill min-h-9 shrink-0 whitespace-nowrap px-3 text-xs"
            >
              {suggested}
            </button>
          ))}
        </div>
      )}

      {term && (
        <div className="feed-content space-y-4 pt-1">
          {/* Search Controls: Sort, Media Filter, 1-Tap Track in Radar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={sort === 'relevance'}
                onClick={() => setSort('relevance')}
                className="choice-pill min-h-9 px-3 text-xs"
              >
                {copy.sortRelevance}
              </button>
              <button
                type="button"
                aria-pressed={sort === 'newest'}
                onClick={() => setSort('newest')}
                className="choice-pill min-h-9 px-3 text-xs"
              >
                {copy.sortNewest}
              </button>
              <button
                type="button"
                aria-pressed={mediaOnly}
                onClick={() => setMediaOnly(prev => !prev)}
                className="choice-pill inline-flex min-h-9 items-center gap-1.5 px-3 text-xs"
              >
                <Film size={13} aria-hidden="true" />
                {copy.filterMediaOnly}
              </button>
            </div>

            {onAddTrackedKeyword && term.length >= 2 && (
              <button
                type="button"
                disabled={isAlreadyTracked}
                onClick={() => {
                  onAddTrackedKeyword(term);
                  remember(term);
                }}
                className="choice-pill inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-semibold"
                aria-pressed={isAlreadyTracked}
              >
                {isAlreadyTracked ? (
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Radar size={13} aria-hidden="true" />
                )}
                <span>{isAlreadyTracked ? copy.trackedInRadar : copy.trackInRadar}</span>
              </button>
            )}
          </div>

          {matchingSources.length > 0 && (
            <section aria-label={t('sourcesTitle')} className="settings-group">
              {matchingSources.map(source => (
                <div key={source.id} className="preference-row justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <SourceIcon source={source} size="h-9 w-9" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{source.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {source.region ? `${source.region} · ` : ''}{source.language.toUpperCase()} · {categoryLabel(source.category)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="source-toggle-btn reaction-btn inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                    data-active={source.subscribed || undefined}
                    aria-pressed={source.subscribed}
                    aria-label={source.subscribed ? `${source.name}: ${t('discoverFollowing')}` : `${source.name}: ${t('discoverFollow')}`}
                    onClick={() => {
                      remember(query);
                      onToggleSubscribe(source.id);
                    }}
                  >
                    {source.subscribed ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {source.subscribed ? t('discoverFollowing') : t('discoverFollow')}
                  </button>
                </div>
              ))}
            </section>
          )}

          <p role="status" className="text-xs font-medium text-[var(--muted)] tabular-nums">
            {t('discoverResultsFor', { count: results.length, query: term })}
          </p>

          {results.length === 0 && matchingSources.length === 0 ? (
            <ViewStatus title={t('discoverNoResults', { query: term })}>
              {t('discoverNoResultsHint')}
            </ViewStatus>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {results.slice(0, visibleLimit).map((article) => (
                  <CompactArticleCard
                    key={article.id}
                    article={article}
                    isBookmarked={profile.bookmarkedIds.includes(article.id)}
                    isLiked={profile.likedIds.includes(article.id)}
                    onOpen={item => {
                      remember(query);
                      onOpenArticle(item);
                    }}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                  />
                ))}
              </div>
              {results.length > visibleLimit && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    className="choice-pill"
                    onClick={() => setVisibleLimit(n => n + 20)}
                  >
                    {copy.loadMore} ({results.length - visibleLimit})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
