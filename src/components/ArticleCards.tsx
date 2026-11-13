import React from 'react';
import { Bookmark, Flame, Heart, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { NewsArticle } from '../types/news';
import { formatRelativeTimeDe } from '../lib/personalization';
import { ArticleImage } from './ArticleImage';

interface CardActionsProps {
  article: NewsArticle;
  isBookmarked: boolean;
  isLiked: boolean;
  reason?: string;
  onOpen: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
}

export const HeroArticleCard: React.FC<CardActionsProps & { badgeLabel?: string; className?: string }> = ({
  article,
  isBookmarked,
  isLiked,
  reason,
  badgeLabel = 'Top-Thema',
  className = '',
  onOpen,
  onToggleBookmark,
  onToggleLike,
}) => {
  const hasMedia = Boolean(article.videoUrl || article.youtubeId || article.audioUrl);
  const showReason = Boolean(reason && reason !== badgeLabel);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-3xl bg-slate-900 shadow-lg ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="relative flex min-h-[300px] sm:min-h-[360px] h-full w-full flex-col justify-between gap-8 p-5 sm:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/50 to-black/25" />
        </div>

        {/* Top kicker */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/15">
            {badgeLabel === 'Schwerpunktthema' ? (
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            ) : (
              <Flame className="h-3.5 w-3.5 text-amber-300" />
            )}
            {badgeLabel}
          </span>
          {hasMedia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/15">
              <Play className="h-3 w-3 fill-current" />
              Medien
            </span>
          )}
        </div>

        {/* Bottom editorial content with generous right clearance for action buttons */}
        <div className="relative z-10 pr-24 sm:pr-28">
          {showReason && (
            <p className="mb-1.5 text-xs font-medium text-blue-300">{reason}</p>
          )}
          <h2 className="line-clamp-3 text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white [text-wrap:balance]">
            {article.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/80">
            {article.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/75 tabular-nums">
            <span className="font-semibold text-white/95">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span>{article.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTimeDe(article.publishedAt)}</span>
          </div>
        </div>
      </button>

      {/* Bottom-right floating glass actions */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleLike(article)}
          aria-label={isLiked ? `Gefällt mir entfernen: ${article.title}` : `Gefällt mir: ${article.title}`}
          aria-pressed={isLiked}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
            isLiked
              ? 'bg-rose-500/90 text-white ring-1 ring-rose-300/40'
              : 'bg-black/50 text-white/90 hover:bg-black/70 ring-1 ring-white/20'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => onToggleBookmark(article)}
          aria-label={isBookmarked ? `Aus Gespeichert entfernen: ${article.title}` : `Artikel speichern: ${article.title}`}
          aria-pressed={isBookmarked}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
            isBookmarked
              ? 'bg-blue-500/95 text-white ring-1 ring-blue-300/40'
              : 'bg-black/50 text-white/90 hover:bg-black/70 ring-1 ring-white/20'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </motion.article>
  );
};

export const CompactArticleCard: React.FC<CardActionsProps> = ({
  article,
  isBookmarked,
  isLiked,
  reason,
  onOpen,
  onToggleBookmark,
  onToggleLike,
}) => {
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="liquid-glass group relative flex items-center gap-3.5 rounded-2xl p-3 sm:p-3.5 transition hover:border-black/15 dark:hover:border-white/15"
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="relative h-20 w-24 sm:h-24 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
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
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
            <span>{article.category}</span>
            {reason && (
              <>
                <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">·</span>
                <span className="truncate text-slate-500 dark:text-slate-400 font-normal">{reason}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[15px] sm:text-base font-semibold leading-snug text-slate-900 dark:text-slate-50 [text-wrap:balance]">
            {article.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
              {article.sourceName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{formatRelativeTimeDe(article.publishedAt)}</span>
          </div>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleBookmark(article)}
          aria-label={isBookmarked ? `Aus Gespeichert entfernen: ${article.title}` : `Artikel speichern: ${article.title}`}
          aria-pressed={isBookmarked}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition active:scale-95 ${
            isBookmarked
              ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
              : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => onToggleLike(article)}
          aria-label={isLiked ? `Gefällt mir entfernen: ${article.title}` : `Gefällt mir: ${article.title}`}
          aria-pressed={isLiked}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition active:scale-95 ${
            isLiked
              ? 'text-rose-500 bg-rose-500/10'
              : 'text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </motion.article>
  );
};

export const BentoArticleCard: React.FC<CardActionsProps> = ({
  article,
  isBookmarked,
  onOpen,
  onToggleBookmark,
}) => {
  return (
    <article className="group relative overflow-hidden rounded-3xl bg-slate-900 shadow-md ring-1 ring-black/10 dark:ring-white/10">
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="block h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Artikel öffnen: ${article.title}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

          <div className="absolute left-3.5 top-3.5">
            <span className="text-xs font-semibold tracking-wide text-blue-300">
              {article.category}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 pr-14">
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-white [text-wrap:balance]">
              {article.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/75">
              {article.summary}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/70 tabular-nums">
              <span className="font-medium text-white/90">{article.sourceName}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTimeDe(article.publishedAt)}</span>
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onToggleBookmark(article)}
        aria-label={isBookmarked ? `Aus Gespeichert entfernen: ${article.title}` : `Artikel speichern: ${article.title}`}
        aria-pressed={isBookmarked}
        className={`absolute bottom-3.5 right-3.5 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
          isBookmarked
            ? 'bg-blue-500/95 text-white ring-1 ring-blue-300/40'
            : 'bg-black/45 text-white/90 hover:bg-black/65 ring-1 ring-white/20'
        }`}
      >
        <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
      </button>
    </article>
  );
};
