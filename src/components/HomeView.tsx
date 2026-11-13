import React from 'react';
import { RefreshCw, Sparkles, User } from 'lucide-react';
import type { NewsArticle, NewsCategory, PersonalizationProfile } from '../types/news';
import { getTimeGreetingDe, type ScoredArticle } from '../lib/personalization';
import { CompactArticleCard, HeroArticleCard } from './ArticleCards';

interface HomeViewProps {
  scoredArticles: ScoredArticle[];
  allArticlesCount: number;
  selectedCategory: NewsCategory;
  onSelectCategory: (cat: NewsCategory) => void;
  profile: PersonalizationProfile;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onOpenSettings: () => void;
}

const HOME_CATEGORIES: NewsCategory[] = [
  'Für dich',
  'Alle',
  'Politik',
  'Wirtschaft',
  'Technologie',
  'Wissenschaft',
  'Europa',
];

export const HomeView: React.FC<HomeViewProps> = ({
  scoredArticles,
  selectedCategory,
  onSelectCategory,
  profile,
  isLoading,
  onRefresh,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onOpenSettings,
}) => {
  const filtered =
    selectedCategory === 'Für dich' || selectedCategory === 'Alle'
      ? scoredArticles
      : scoredArticles.filter((s) => s.article.category === selectedCategory);

  const heroEntry = filtered[0];
  const featuredSideEntries = filtered.slice(1, 4);
  const restEntries = filtered.slice(4);

  return (
    <section aria-label="Startseite Nachrichten" className="space-y-5">
      {/* Header matching Apple News / PDF Page 4 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {getTimeGreetingDe()}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Deine persönlichen Nachrichten
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Nachrichten aktualisieren"
            className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Quellen und Einstellungen öffnen"
            className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition hover:scale-105 active:scale-95 md:hidden"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="Nachrichten-Rubriken"
        className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      >
        {HOME_CATEGORIES.map((cat) => {
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
            Keine Artikel in „{selectedCategory}“ gefunden
          </p>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Aktiviere weitere RSS-Quellen in den Einstellungen oder wähle eine andere Rubrik.
          </p>
          <button
            type="button"
            onClick={() => onSelectCategory('Für dich')}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Zurück zu „Für dich“
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
            {heroEntry && (
              <div className={featuredSideEntries.length > 0 ? 'lg:col-span-7 flex' : 'lg:col-span-12'}>
                <HeroArticleCard
                  article={heroEntry.article}
                  reason={selectedCategory === 'Für dich' ? heroEntry.reason : undefined}
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
                {featuredSideEntries.map(({ article, reason }) => (
                  <CompactArticleCard
                    key={article.id}
                    article={article}
                    reason={selectedCategory === 'Für dich' ? reason : undefined}
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
              {restEntries.map(({ article, reason }) => (
                <CompactArticleCard
                  key={article.id}
                  article={article}
                  reason={selectedCategory === 'Für dich' ? reason : undefined}
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
      )}
    </section>
  );
};
