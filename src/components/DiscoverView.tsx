import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Search, User } from 'lucide-react';
import type { NewsArticle, NewsCategory, NewsSource, PersonalizationProfile } from '../types/news';
import { BentoArticleCard, CompactArticleCard, HeroArticleCard } from './ArticleCards';

interface DiscoverViewProps {
  articles: NewsArticle[];
  sources: NewsSource[];
  profile: PersonalizationProfile;
  onToggleSubscribe: (sourceId: string) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onOpenSourcesSettings: () => void;
}

const DISCOVER_CATEGORIES: NewsCategory[] = [
  'Alle',
  'Politik',
  'Wirtschaft',
  'Technologie',
  'Wissenschaft',
  'Europa',
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  articles,
  sources,
  profile,
  onToggleSubscribe,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onOpenSourcesSettings,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NewsCategory>('Alle');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const catOk = category === 'Alle' || a.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [articles, category, query]);

  const hero = filtered[0];
  const bentoCards = filtered.slice(1, 5);
  const moreCards = filtered.slice(5, 13);
  const popularSources = sources.filter((s) => s.recommended).slice(0, 8);

  return (
    <section aria-label="Entdecken" className="space-y-6">
      {/* Header matching PDF Page 2 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Entdecken
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Finde Themen, Quellen und Trends
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSourcesSettings}
          aria-label="Quellen und Integrationen verwalten"
          className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition hover:scale-105 active:scale-95 md:hidden"
        >
          <User className="h-4 w-4" />
        </button>
      </div>

      {/* Inline Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Themen, Quellen oder Schlagwörter"
          aria-label="Themen, Quellen oder Schlagwörter suchen"
          className="liquid-glass w-full rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:text-white"
        />
      </div>

      {/* Topic Filter Chips */}
      <div
        role="tablist"
        aria-label="Themenfilter"
        className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      >
        {DISCOVER_CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setCategory(cat)}
              className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                active
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'liquid-glass-subtle text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Schwerpunktthema Hero */}
      {hero && (
        <HeroArticleCard
          article={hero}
          badgeLabel="Schwerpunktthema"
          isBookmarked={profile.bookmarkedIds.includes(hero.id)}
          isLiked={profile.likedIds.includes(hero.id)}
          onOpen={onOpenArticle}
          onToggleBookmark={onToggleBookmark}
          onToggleLike={onToggleLike}
        />
      )}

      {/* 2-Column Bento Grid */}
      {bentoCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bentoCards.map((article) => (
            <BentoArticleCard
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

      {/* Beliebte Quellen Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Beliebte Quellen
          </h2>
          <button
            type="button"
            onClick={onOpenSourcesSettings}
            className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Alle Quellen anzeigen
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4">
          {popularSources.map((src) => (
            <div
              key={src.id}
              className="liquid-glass flex w-44 shrink-0 lg:w-auto flex-col justify-between rounded-2xl p-3.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: src.accentColor }}
                  >
                    {src.shortCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(src.id)}
                    aria-label={src.subscribed ? `${src.name} entfolgen` : `${src.name} folgen`}
                    aria-pressed={src.subscribed}
                    className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition active:scale-95 ${
                      src.subscribed
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20'
                    }`}
                  >
                    {src.subscribed ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {src.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {src.description}
                </p>
              </div>
              <div className="mt-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {src.category} · {src.format.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Discovered Articles */}
      {moreCards.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Weitere Meldungen
          </h2>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {moreCards.map((article) => (
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
        </div>
      )}

      {filtered.length === 0 && (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            Keine passenden Beiträge gefunden
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Versuche einen anderen Suchbegriff oder wähle „Alle“.
          </p>
        </div>
      )}
    </section>
  );
};
