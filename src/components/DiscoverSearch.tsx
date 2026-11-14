import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { CompactArticleCard } from './ArticleCards';

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

const SUGGESTED_TERMS = ['Europa', 'KI', 'Bundestag', 'Energie', 'Wirtschaft', 'NASA', 'Tagesschau'];

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

  const term = query.trim().toLowerCase();
  const matchingSources = term ? sources.filter(source =>
    [source.name, source.category, source.description].some(value => value.toLowerCase().includes(term))
  ) : [];

  return (
    <div className="space-y-4">
      <form className="relative" role="search" onSubmit={event => {
        event.preventDefault();
        remember(query);
        event.currentTarget.querySelector('input')?.blur();
      }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nachrichten, Themen, Quellen"
          aria-label="Nachrichten, Themen und Quellen durchsuchen"
          className="preference-input w-full rounded-full py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:text-white"
        />
      </form>
      {!query.trim() && recent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Letzte Suchen</h2>
            <button type="button" className="choice-pill" onClick={() => setRecent([])}>Alle löschen</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map(term => <button key={term} type="button" className="choice-pill" onClick={() => { setQuery(term); remember(term); }}>{term}</button>)}
          </div>
        </div>
      )}

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {SUGGESTED_TERMS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => { setQuery(term === query ? '' : term); if (term !== query) remember(term); }}
            className={`min-h-[38px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              query === term
                ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
                : 'liquid-glass-subtle text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {term}
          </button>
        ))}
      </div>

      {term && <>
        {matchingSources.length > 0 && (
          <section aria-label="Gefundene Quellen" className="settings-group">
            {matchingSources.map(source => (
              <div key={source.id} className="preference-row justify-between">
                <div className="min-w-0">
                  <div className="font-semibold">{source.name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{source.category}</div>
                </div>
                <button type="button" className="choice-pill shrink-0" aria-pressed={source.subscribed}
                  aria-label={source.subscribed ? `${source.name} entfolgen` : `${source.name} folgen`}
                  onClick={() => { remember(query); onToggleSubscribe(source.id); }}>
                  {source.subscribed ? 'Abonniert' : 'Folgen'}
                </button>
              </div>
            ))}
          </section>
        )}
        <p role="status" className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {results.length} Meldungen für „{query.trim()}“
        </p>
      {results.length === 0 && matchingSources.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            Keine Ergebnisse für „{query}“
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Probiere ein anderes Stichwort oder abonniere weitere Feeds in den Einstellungen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {results.map((article) => (
            <CompactArticleCard
              key={article.id}
              article={article}
              isBookmarked={profile.bookmarkedIds.includes(article.id)}
              isLiked={profile.likedIds.includes(article.id)}
              onOpen={article => { remember(query); onOpenArticle(article); }}
              onToggleBookmark={onToggleBookmark}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      )}
      </>}
    </div>
  );
};
