import React from 'react';
import { Flame, Heart, Play, Sparkles } from 'lucide-react';
import type { NewsArticle } from '../types/news';
import { formatRelativeTimeDe } from '../lib/personalization';
import { ArticleImage } from './ArticleImage';

interface CardActionsProps {
  article: NewsArticle;
  isBookmarked: boolean;
  isLiked: boolean;
  onOpen: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  Politik: 'bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  Wirtschaft: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  Technologie: 'bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  Wissenschaft: 'bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  Europa: 'bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  Gesellschaft: 'bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  Kultur: 'bg-purple-500/12 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300',
  Sport: 'bg-orange-500/12 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
};

export const HeroArticleCard: React.FC<CardActionsProps & { badgeLabel?: string; className?: string }> = ({
  article,
  isLiked,
  badgeLabel = 'Top-Thema',
  className = '',
  onOpen,
  onToggleLike,
}) => {
  const hasMedia = Boolean(article.videoUrl || article.youtubeId || article.audioUrl);

  return (
    <article
      className={`article-card group relative overflow-hidden bg-slate-900 shadow-lg ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="relative flex min-h-[290px] sm:min-h-[340px] h-full w-full flex-col justify-between gap-8 p-5 sm:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="article-thumbnail pointer-events-none absolute inset-0 overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15" />
        </div>

        {/* Top Frosted Kicker */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/25">
            {badgeLabel === 'Schwerpunktthema' ? (
              <Sparkles className="h-3.5 w-3.5 text-white" />
            ) : (
              <Flame className="h-3.5 w-3.5 text-amber-200" />
            )}
            {badgeLabel}
          </span>
          {hasMedia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20">
              <Play className="h-3 w-3 fill-current" />
              Medien
            </span>
          )}
        </div>

        {/* Bottom Editorial Copy */}
        <div className="relative z-10 pb-12">
          <h2 className="line-clamp-3 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
            {article.title}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-[13px] sm:text-sm leading-relaxed text-white/85">
            {article.summary}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-white/80 tabular-nums">
            <span className="font-medium text-white">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span>{article.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTimeDe(article.publishedAt)}</span>
          </div>
        </div>
      </button>

      {/* Bottom-right Frosted Glass Action Circles */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleLike(article)}
          aria-label={isLiked ? `Gefällt mir entfernen: ${article.title}` : `Gefällt mir: ${article.title}`}
          aria-pressed={isLiked}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur-xl transition active:scale-95 ${
            isLiked
              ? 'bg-rose-500/90 text-white ring-1 ring-rose-300/40'
              : 'bg-white/20 text-white hover:bg-white/30 ring-1 ring-white/25'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </article>
  );
};

export const CompactArticleCard: React.FC<CardActionsProps> = ({
  article,
  isLiked,
  onOpen,
  onToggleLike,
}) => {
  const catBadge =
    CATEGORY_BADGE_STYLES[article.category] ||
    'bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300';

  return (
    <article
      className="liquid-glass article-card article-card-compact group relative flex items-center gap-3 p-2.5 sm:p-3 transition hover:scale-[1.005]"
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="article-thumbnail relative h-[76px] w-[104px] sm:h-[84px] sm:w-[116px] shrink-0 overflow-hidden rounded-[15px] bg-slate-200 dark:bg-slate-800">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
          {(article.videoUrl || article.youtubeId) && (
            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
              <Play className="h-3 w-3 fill-current" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={`inline-flex rounded-full px-2 py-0.5 ${catBadge}`}>
              {article.category}
            </span>
          </div>
          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-50 [text-wrap:balance]">
            {article.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="truncate max-w-[130px] font-medium text-slate-600 dark:text-slate-300">
              {article.sourceName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{formatRelativeTimeDe(article.publishedAt)}</span>
          </div>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={() => onToggleLike(article)}
          aria-label={isLiked ? `Gefällt mir entfernen: ${article.title}` : `Gefällt mir: ${article.title}`}
          aria-pressed={isLiked}
          className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition active:scale-95 ${
            isLiked
              ? 'text-rose-500 bg-rose-500/12'
              : 'text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </article>
  );
};

export const BentoArticleCard: React.FC<CardActionsProps & { tall?: boolean; className?: string }> = ({
  article,
  tall = false,
  className = '',
  onOpen,
}) => {
  return (
    <article
      className={`article-card group relative overflow-hidden bg-slate-900 shadow-md ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className={`relative flex w-full flex-col justify-between gap-4 p-3.5 sm:p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          tall ? 'h-full min-h-[300px] sm:min-h-[350px]' : 'h-full min-h-[144px] sm:min-h-[168px]'
        }`}
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="article-thumbnail pointer-events-none absolute inset-0 overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/15" />
        </div>

        <div className="relative z-10">
          <span className="inline-block rounded-full bg-white/22 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/20">
            {article.category}
          </span>
        </div>

        <div className="relative z-10 pr-9 sm:pr-11">
          <h3 className={`${tall ? 'text-base sm:text-xl line-clamp-3' : 'text-[13px] sm:text-[15px] line-clamp-2'} font-bold leading-snug text-white [text-wrap:balance]`}>
            {article.title}
          </h3>
          <p className={`mt-1 text-[11px] sm:text-xs leading-relaxed text-white/80 ${tall ? 'line-clamp-3' : 'hidden sm:line-clamp-2'}`}>
            {article.summary}
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] sm:text-[11px] text-white/75 tabular-nums truncate">
            <span className="font-medium text-white/95 truncate">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{formatRelativeTimeDe(article.publishedAt)}</span>
          </div>
        </div>
      </button>
    </article>
  );
};
