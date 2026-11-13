import politicsImage from '../assets/images/news_bundestag_berlin_1794556463691.jpg';
import businessImage from '../assets/images/news_renewable_europe_1794556463653.jpg';
import technologyImage from '../assets/images/news_ai_semiconductor_1794556462965.jpg';
import societyImage from '../assets/images/news_eu_parliament_1794556462855.jpg';
import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Search } from 'lucide-react';
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
  'Gesellschaft',
  'Kultur',
  'Sport',
];

const featuredTopics = [
  { topic: 'Politik', image: politicsImage },
  { topic: 'Wirtschaft', image: businessImage },
  { topic: 'Technologie', image: technologyImage },
  { topic: 'Gesellschaft', image: societyImage },
] as const;

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
  const bentoLeft = filtered[1];
  const bentoRightTop = filtered[2];
  const bentoRightBottom = filtered[3];
  const moreCards = filtered.slice(4, 12);
  const popularSources = sources.filter((s) => s.recommended).slice(0, 4);

  return (
    <section aria-label="Entdecken" className="space-y-5">
      {/* Header matching Screenshot 2 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Entdecken
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Finde Themen, Quellen und Trends
          </p>
        </div>

      </div>

      {/* Inline Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Themen, Quellen oder Schlagwörter"
          aria-label="Themen, Quellen oder Schlagwörter suchen"
          className="liquid-glass w-full rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Themen entdecken">
        {featuredTopics.map(({ topic, image }) => (
          <button key={topic} type="button" className="topic-card" aria-pressed={category === topic}
            onClick={() => setCategory(category === topic ? 'Alle' : topic)}>
            <img src={image} alt="" />
            <span>{topic}</span>
          </button>
        ))}
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
                  ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
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

      {/* Asymmetric Bento Grid matching Screenshot 2 (1 tall left + 2 stacked right) */}
      {bentoLeft && (
        <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-3.5">
          <BentoArticleCard
            article={bentoLeft}
            tall
            className="row-span-2"
            isBookmarked={profile.bookmarkedIds.includes(bentoLeft.id)}
            isLiked={profile.likedIds.includes(bentoLeft.id)}
            onOpen={onOpenArticle}
            onToggleBookmark={onToggleBookmark}
            onToggleLike={onToggleLike}
          />
          {bentoRightTop && (
            <BentoArticleCard
              article={bentoRightTop}
              isBookmarked={profile.bookmarkedIds.includes(bentoRightTop.id)}
              isLiked={profile.likedIds.includes(bentoRightTop.id)}
              onOpen={onOpenArticle}
              onToggleBookmark={onToggleBookmark}
              onToggleLike={onToggleLike}
            />
          )}
          {bentoRightBottom && (
            <BentoArticleCard
              article={bentoRightBottom}
              isBookmarked={profile.bookmarkedIds.includes(bentoRightBottom.id)}
              isLiked={profile.likedIds.includes(bentoRightBottom.id)}
              onOpen={onOpenArticle}
              onToggleBookmark={onToggleBookmark}
              onToggleLike={onToggleLike}
            />
          )}
        </div>
      )}

      {/* Beliebte Quellen Carousel matching Screenshot 2 */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Beliebte Quellen
          </h2>
          <button
            type="button"
            onClick={onOpenSourcesSettings}
            className="inline-flex min-h-[44px] items-center gap-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Alle Quellen anzeigen
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 sm:grid sm:grid-cols-4">
          {popularSources.map((src) => (
            <div
              key={src.id}
              className="liquid-glass flex w-[142px] shrink-0 sm:w-auto flex-col justify-between rounded-[20px] p-3"
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: src.accentColor }}
                  >
                    {src.shortCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(src.id)}
                    aria-label={src.subscribed ? `${src.name} entfolgen` : `${src.name} folgen`}
                    aria-pressed={src.subscribed}
                    className={`flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full transition active:scale-95 ${
                      src.subscribed
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200/80 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                    }`}
                  >
                    {src.subscribed ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <h3 className="mt-2.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                  {src.name}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  {src.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Discovered Articles */}
      {moreCards.length > 0 && (
        <div className="space-y-3 pt-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Weitere Meldungen
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
