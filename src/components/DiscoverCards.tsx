import React from 'react';
import { Play } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { ArticleActions, type CardActionsProps } from './ArticleCards';
import { ArticleImage } from './ArticleImage';

export const HeroArticleCard: React.FC<CardActionsProps & { badgeLabel?: string; className?: string }> = React.memo(function HeroArticleCard({
  article,
  badgeLabel,
  className = '',
  onOpen,
  ...actions
}) {
  const { t, categoryLabel, formatRelative } = useI18n();
  const resolvedBadge = badgeLabel ?? t('topStory');
  const hasMedia = Boolean(article.videoUrl || article.youtubeId || article.audioUrl);

  return (
    <article
      className={`article-card article-card-interactive group relative overflow-hidden bg-slate-900 shadow-lg ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="relative flex min-h-[296px] sm:min-h-[348px] h-full w-full flex-col justify-between gap-8 p-5 sm:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`${t('openArticle')}: ${article.title}`}
      >
        <div className="article-thumbnail pointer-events-none absolute inset-0 overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            priority
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/48 to-black/15" />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-white/92 drop-shadow-sm">
            {resolvedBadge}
          </span>
          {hasMedia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
              {t('mediaLabel')}
            </span>
          )}
        </div>

        <div className="relative z-10 pb-12">
          <h2 className="line-clamp-3 text-[1.45rem] sm:text-3xl font-bold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
            {article.title}
          </h2>
          {article.summary && (
            <p className="mt-2 line-clamp-2 text-[13.5px] sm:text-sm leading-relaxed text-white/85">
              {article.summary}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-white/80 tabular-nums">
            <span className="font-semibold text-white">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span>{categoryLabel(article.category)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(article.publishedAt)}</span>
          </div>
        </div>
      </button>

      <ArticleActions article={article} {...actions} layout="overlay" />
    </article>
  );
});

export const BentoArticleCard: React.FC<CardActionsProps & { tall?: boolean; className?: string }> = React.memo(function BentoArticleCard({
  article,
  tall = false,
  className = '',
  onOpen,
  ...actions
}) {
  const { t, categoryLabel, formatRelative } = useI18n();
  return (
    <article
      className={`article-card article-card-interactive group relative overflow-hidden bg-slate-900 shadow-md ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(article)}
        className={`relative flex w-full flex-col justify-between gap-3 p-3.5 sm:p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          tall ? 'h-full min-h-[300px] sm:min-h-[350px]' : 'h-full min-h-[180px] sm:min-h-[192px]'
        }`}
        aria-label={`${t('openArticle')}: ${article.title}`}
      >
        <div className="article-thumbnail pointer-events-none absolute inset-0 overflow-hidden">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/48 to-black/15" />
        </div>

        <div className="relative z-10">
          <span className="text-[11px] font-bold tracking-wide text-white/90 drop-shadow-sm">
            {categoryLabel(article.category)}
          </span>
        </div>

        <div className="relative z-10 pb-12">
          <h3 className={`${tall ? 'text-base sm:text-xl line-clamp-3' : 'text-[13.5px] sm:text-[15px] line-clamp-2'} font-bold leading-snug text-white [text-wrap:balance]`}>
            {article.title}
          </h3>
          {article.summary && (
            <p className={`mt-1 text-[11.5px] sm:text-xs leading-relaxed text-white/80 ${tall ? 'line-clamp-3' : 'hidden sm:line-clamp-2'}`}>
              {article.summary}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-[10.5px] sm:text-[11px] text-white/78 tabular-nums truncate">
            <span className="font-medium text-white/95 truncate">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{formatRelative(article.publishedAt)}</span>
          </div>
        </div>
      </button>
      <ArticleActions article={article} {...actions} layout="overlay" />
    </article>
  );
});
