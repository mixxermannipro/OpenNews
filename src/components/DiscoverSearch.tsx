import React, { useMemo } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
  profile: PersonalizationProfile;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

const SUGGESTED_BY_LANG = {
  de: ['Europa', 'KI', 'Wirtschaft', 'NASA', 'Tagesschau', 'Le Monde', 'BBC'],
  en: ['Europe', 'AI', 'Economy', 'NASA', 'BBC', 'The Guardian', 'Tech'],
  fr: ['Europe', 'IA', 'Économie', 'Le Monde', 'France 24', 'NASA', 'Science'],
  es: ['Europa', 'IA', 'Economía', 'El País', 'BBC Mundo', 'NASA', 'Tech'],
  it: ['Europa', 'IA', 'Economia', 'ANSA', 'Il Post', 'NASA', 'Tech'],
  pt: ['Europa', 'IA', 'Economia', 'Público', 'Folha', 'NASA', 'Tech'],
} as const;

export const DiscoverSearch: React.FC<DiscoverSearchProps> = ({
  articles,
  sources,
  query,
  onQuery: setQuery,
  onToggleSubscribe,
  profile,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
}) => {
  const { lang, locale, t, categoryLabel } = useI18n();
  const [recent, setRecent] = useLocalStorage<string[]>('opennews_recent_searches', []);
  const remember = (value: string) => {
    const term = value.trim();
    if (term) setRecent(previous => [term, ...previous.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 6));
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.includes(q))
    );
  }, [articles, query]);

  const term = query.trim();
  const matchingSources = useMemo(
    () => (term ? searchAndFilterSources(sources, { query: term, locale }).slice(0, 12) : []),
    [sources, term, locale],
  );

  const suggestedTerms = SUGGESTED_BY_LANG[lang] ?? SUGGESTED_BY_LANG.de;

  return (
    <div className="space-y-4">
      <form
        className="relative"
        role="search"
        onSubmit={event => {
          event.preventDefault();
          remember(query);
          event.currentTarget.querySelector('input')?.blur();
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('discoverSearchPlaceholder')}
          aria-label={t('discoverSearchPlaceholder')}
          className={`preference-input discover-search-input w-full rounded-full text-sm text-[var(--ink)] placeholder:text-[var(--muted)] ${query ? 'pr-12' : ''}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clear')}
            className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {!query.trim() && recent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight">{t('discoverRecent')}</h2>
            <button type="button" className="choice-pill text-xs" onClick={() => setRecent([])}>{t('discoverClearRecent')}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map(savedTerm => (
              <button
                key={savedTerm}
                type="button"
                className="choice-pill"
                onClick={() => { setQuery(savedTerm); remember(savedTerm); }}
              >
                {savedTerm}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {suggestedTerms.map((suggested) => (
          <button
            key={suggested}
            type="button"
            aria-pressed={query === suggested}
            onClick={() => { setQuery(suggested === query ? '' : suggested); if (suggested !== query) remember(suggested); }}
            className="choice-pill shrink-0 whitespace-nowrap"
          >
            {suggested}
          </button>
        ))}
      </div>

      {term && (
        <div className="feed-content space-y-4">
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
                    onClick={() => { remember(query); onToggleSubscribe(source.id); }}
                  >
                    {source.subscribed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
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
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {results.map((article) => (
                <CompactArticleCard
                  key={article.id}
                  article={article}
                  isBookmarked={profile.bookmarkedIds.includes(article.id)}
                  isLiked={profile.likedIds.includes(article.id)}
                  onOpen={item => { remember(query); onOpenArticle(item); }}
                  onToggleBookmark={onToggleBookmark}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
