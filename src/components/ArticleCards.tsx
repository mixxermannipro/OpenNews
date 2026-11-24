import React, { useRef, useState } from 'react';
import { Bookmark, Flame, Heart, Play, Sparkles, ThumbsDown } from 'lucide-react';
import type { NewsArticle } from '../types/news';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { classifyArticleType, detectAndClarifyClickbait, type EditorialArticleType } from '../lib/localEditorialAI';
import { evaluateSwipeMove, shouldCommitSwipe, type SwipeAxis } from '../lib/swipePhysics';
import { ArticleImage } from './ArticleImage';
import { SourceIcon } from './SourceIcon';

const TYPE_LABEL_KEY: Partial<Record<EditorialArticleType, TranslationKey>> = {
  breaking: 'breaking',
  opinion: 'typeOpinion',
  analysis: 'typeAnalysis',
  interview: 'typeInterview',
  factcheck: 'typeFactcheck',
};

interface CardActionsProps {
  article: NewsArticle;
  isBookmarked: boolean;
  isLiked: boolean;
  onOpen: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onDismissLessLikeThis?: (article: NewsArticle) => void;
}

const CATEGORY_TEXT_STYLES: Record<string, string> = {
  Politik: 'text-rose-700 dark:text-rose-400',
  Wirtschaft: 'text-emerald-700 dark:text-emerald-400',
  Technologie: 'text-sky-700 dark:text-sky-400',
  Wissenschaft: 'text-indigo-700 dark:text-indigo-400',
  Europa: 'text-blue-700 dark:text-blue-400',
  Gesellschaft: 'text-amber-700 dark:text-amber-400',
  Kultur: 'text-purple-700 dark:text-purple-400',
  Sport: 'text-orange-700 dark:text-orange-400',
};

function ArticleActions({ article, isBookmarked, isLiked, onToggleBookmark, onToggleLike, onDismissLessLikeThis, layout = 'row' }:
  Omit<CardActionsProps, 'onOpen'> & { layout?: 'column' | 'row' | 'overlay' }) {
  const { t } = useI18n();
  const overlay = layout === 'overlay';
  const style = overlay
    ? 'bg-black/48 text-white ring-1 ring-white/22 backdrop-blur-md hover:bg-black/68'
    : 'text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]';
  const position = { column: 'flex flex-col', row: 'flex items-center gap-0.5', overlay: 'absolute bottom-3 right-3 z-20 flex gap-1.5' };
  const buttonStyle = `reaction-btn flex h-11 w-11 items-center justify-center rounded-full ${style}`;
  return (
    <div className={`${position[layout]} shrink-0 items-center`}>
      {onDismissLessLikeThis && !overlay && (
        <button
          type="button"
          className={`${buttonStyle} hidden md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity`}
          onClick={() => onDismissLessLikeThis(article)}
          aria-label={`${t('swipeLessLikeThis')}: ${article.title}`}
          title={t('swipeLessLikeThis')}
        >
          <ThumbsDown size={15} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={buttonStyle}
        data-active={isLiked || undefined}
        onClick={() => onToggleLike(article)}
        aria-pressed={isLiked}
        aria-label={isLiked ? `${t('unlike')}: ${article.title}` : `${t('like')}: ${article.title}`}
      >
        <Heart
          size={17}
          className={isLiked ? 'fill-current text-rose-500 dark:text-rose-400' : undefined}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className={buttonStyle}
        data-active={isBookmarked || undefined}
        onClick={() => onToggleBookmark(article)}
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? `${t('unbookmark')}: ${article.title}` : `${t('bookmark')}: ${article.title}`}
      >
        <Bookmark
          size={17}
          className={isBookmarked ? 'fill-current text-[var(--accent)]' : undefined}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function SwipeableArticleCard({
  article,
  enabled,
  onDismiss,
  children,
}: {
  article: NewsArticle;
  enabled: boolean;
  onDismiss?: (article: NewsArticle) => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const shellRef = useRef<HTMLDivElement>(null);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const touchRef = useRef<{ x: number; y: number; dx: number; time: number; axis: SwipeAxis; buzzed: boolean } | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [dismissingDir, setDismissingDir] = useState<-1 | 0 | 1>(0);

  React.useEffect(() => () => window.clearTimeout(dismissTimerRef.current), []);

  if (!enabled || !onDismiss) {
    return <>{children}</>;
  }

  const reset = () => {
    touchRef.current = null;
    setDragging(false);
    setOffsetX(0);
    setReady(false);
  };

  return (
    <div
      ref={shellRef}
      className="swipe-card-shell group"
      onTouchStart={event => {
        if (dismissingDir !== 0 || event.touches.length !== 1) return;
        const { clientX, clientY } = event.touches[0];
        touchRef.current = { x: clientX, y: clientY, dx: 0, time: performance.now(), axis: 'none', buzzed: false };
      }}
      onTouchMove={event => {
        const state = touchRef.current;
        if (!state || dismissingDir !== 0 || event.touches.length !== 1) return;
        const { clientX, clientY } = event.touches[0];
        const dx = clientX - state.x;
        const dy = clientY - state.y;
        const width = shellRef.current?.clientWidth || 360;
        const move = evaluateSwipeMove(dx, dy, width, state.axis);
        state.axis = move.axis;
        state.dx = dx;

        if (move.axis === 'vertical') {
          if (dragging) reset();
          return;
        }
        if (move.axis === 'horizontal') {
          if (!dragging) setDragging(true);
          setOffsetX(move.offsetX);
          setReady(move.pastThreshold);
          if (move.pastThreshold && !state.buzzed) {
            state.buzzed = true;
            navigator.vibrate?.(12);
          } else if (!move.pastThreshold) {
            state.buzzed = false;
          }
        }
      }}
      onTouchEnd={() => {
        const state = touchRef.current;
        if (!state || state.axis !== 'horizontal') {
          reset();
          return;
        }
        const width = shellRef.current?.clientWidth || 360;
        const elapsed = performance.now() - state.time;
        if (shouldCommitSwipe(state.dx, elapsed, width)) {
          const dir = state.dx < 0 ? -1 : 1;
          touchRef.current = null;
          setDragging(false);
          setDismissingDir(dir);
          setOffsetX(dir * (width + 40));
          window.clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = window.setTimeout(() => {
            onDismiss(article);
          }, 210);
        } else {
          reset();
        }
      }}
      onTouchCancel={reset}
    >
      {(dragging || dismissingDir !== 0) && (
        <div className="swipe-card-backdrop" data-ready={ready || dismissingDir !== 0} aria-hidden="true">
          <span className={`inline-flex items-center gap-2 text-xs font-bold transition-opacity ${offsetX > 12 ? 'opacity-100' : 'opacity-0'}`}>
            <ThumbsDown size={15} />
            {t('swipeLessLikeThis')}
          </span>
          <span className={`inline-flex items-center gap-2 text-xs font-bold transition-opacity ${offsetX < -12 ? 'opacity-100' : 'opacity-0'}`}>
            {t('swipeLessLikeThis')}
            <ThumbsDown size={15} />
          </span>
        </div>
      )}
      <div
        className="swipe-card-surface"
        data-dragging={dragging || undefined}
        data-dismissing={dismissingDir !== 0 || undefined}
        style={offsetX !== 0 ? { transform: `translate3d(${offsetX}px, 0, 0)` } : undefined}
        onClickCapture={event => {
          if (Math.abs(offsetX) > 10 || dismissingDir !== 0) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const HeroArticleCard: React.FC<CardActionsProps & { badgeLabel?: string; className?: string }> = ({
  article,
  badgeLabel,
  className = '',
  onOpen,
  ...actions
}) => {
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md ring-1 ring-white/20">
            {resolvedBadge === t('featuredTopic') ? (
              <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            ) : (
              <Flame className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            )}
            {resolvedBadge}
          </span>
          {hasMedia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20">
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
};

export function HeadlineArticleCard({ article, lead = false, onOpen, ...actions }:
  CardActionsProps & { lead?: boolean }) {
  const { t, categoryLabel, formatRelative } = useI18n();
  const Heading = lead ? 'h2' : 'h3';
  const hasVideo = Boolean(article.videoUrl || article.youtubeId);
  const categoryColor = article.isBreaking
    ? 'text-rose-700 dark:text-rose-400'
    : (CATEGORY_TEXT_STYLES[article.category] || 'text-[var(--accent)]');
  const localizedCategory = categoryLabel(article.category);
  const articleType = React.useMemo(() => classifyArticleType(article), [article]);
  const typeKey = TYPE_LABEL_KEY[articleType];
  const kicker = typeKey ? `${t(typeKey)} · ${localizedCategory}` : localizedCategory;
  const clickbait = React.useMemo(() => detectAndClarifyClickbait(article), [article]);

  return (
    <article className={`settings-group article-card article-card-interactive min-w-0 overflow-hidden ${lead ? 'article-card-lead' : ''}`}>
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
      >
        {article.imageUrl && (
          <div className={`article-thumbnail relative w-full overflow-hidden bg-[var(--control)] ${lead ? 'aspect-[16/9] sm:aspect-[2.05] max-h-[25rem]' : 'aspect-[16/9] sm:aspect-[2.15] max-h-[21rem]'}`}>
            <ArticleImage
              key={article.imageUrl}
              src={article.imageUrl}
              alt=""
              sourceShortCode={article.sourceShortCode}
              sourceColor={article.sourceColor}
              priority={lead}
              className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
            {hasVideo && (
              <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Play size={11} fill="currentColor" aria-hidden="true" />
                {t('videoLabel')}
              </span>
            )}
          </div>
        )}
        <div className={`${lead ? 'px-4 pt-4 sm:px-6 sm:pt-5' : 'px-4 pt-3.5 sm:px-5 sm:pt-4'}`}>
          <p className={`text-xs font-bold tracking-wide ${categoryColor}`}>
            {kicker}
          </p>
          <Heading
            className={`mt-1.5 font-extrabold tracking-[-0.025em] text-[var(--ink)] [overflow-wrap:anywhere] [text-wrap:balance] transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-80 ${
              lead
                ? 'text-[clamp(1.45rem,5.4vw,2.35rem)] leading-[1.12]'
                : 'text-[clamp(1.2rem,4.3vw,1.65rem)] leading-[1.18]'
            }`}
          >
            {article.title}
          </Heading>
          {clickbait.isClickbait && clickbait.clarifiedLead ? (
            <p className="mt-2 max-w-[65ch] text-[13.5px] leading-[1.5] text-[var(--ink-soft,var(--muted))]">
              <span className="font-semibold text-[var(--accent)]">{t('clickbaitShort')}: </span>
              {clickbait.clarifiedLead}
            </p>
          ) : article.summary && (
            <p className={`mt-2.5 line-clamp-3 max-w-[65ch] text-[var(--muted)] ${lead ? 'text-[15px] leading-[1.55] sm:text-base' : 'text-[14px] leading-[1.5] sm:text-[15px]'}`}>
              {article.summary}
            </p>
          )}
        </div>
      </button>
      <div className={`mt-2 flex items-center justify-between gap-x-2 pb-1.5 ${lead ? 'px-4 sm:px-6' : 'px-4 sm:px-5'}`}>
        <div className="flex min-w-0 items-center gap-2 py-1 text-xs leading-snug text-[var(--muted)] tabular-nums">
          <SourceIcon
            source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
            size="h-4 w-4 rounded-[4px] text-[7px]"
          />
          <p className="min-w-0 truncate">
            <span className="font-semibold text-[var(--ink)]">{article.sourceName}</span>
            <span aria-hidden="true"> · </span>
            <span>{formatRelative(article.publishedAt)}</span>
          </p>
        </div>
        <ArticleActions article={article} {...actions} layout="row" />
      </div>
    </article>
  );
}

export const CompactArticleCard: React.FC<CardActionsProps> = ({
  article,
  onOpen,
  ...actions
}) => {
  const { t, categoryLabel, formatRelative } = useI18n();
  const categoryColor = article.isBreaking
    ? 'text-rose-700 dark:text-rose-400'
    : (CATEGORY_TEXT_STYLES[article.category] || 'text-[var(--accent)]');
  const localizedCategory = categoryLabel(article.category);
  const articleType = React.useMemo(() => classifyArticleType(article), [article]);
  const typeKey = TYPE_LABEL_KEY[articleType];
  const kicker = typeKey ? `${t(typeKey)} · ${localizedCategory}` : localizedCategory;

  return (
    <article className="liquid-glass article-card article-card-compact article-card-interactive group relative flex flex-col justify-between p-3 sm:p-3.5">
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="flex min-w-0 w-full items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl"
        aria-label={`${t('openArticle')}: ${article.title}`}
      >
        <div className="article-thumbnail relative h-[78px] w-[78px] sm:h-[86px] sm:w-[114px] shrink-0 overflow-hidden rounded-[14px] bg-[var(--control)]">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
          {(article.videoUrl || article.youtubeId) && (
            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-[11.5px] font-bold tracking-[0.01em] ${categoryColor}`}>
            {kicker}
          </p>
          <h3 className="mt-0.5 line-clamp-3 [overflow-wrap:anywhere] text-[15px] font-bold leading-[1.3] tracking-[-0.015em] text-[var(--ink)] [text-wrap:balance] transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-80">
            {article.title}
          </h3>
        </div>
      </button>

      <div className="mt-1.5 flex items-center justify-between gap-2 pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)] tabular-nums">
          <SourceIcon
            source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
            size="h-4 w-4 rounded-[4px] text-[7px]"
          />
          <span className="truncate font-medium text-[var(--ink)]/85">
            {article.sourceName}
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{formatRelative(article.publishedAt)}</span>
        </div>
        <ArticleActions article={article} {...actions} layout="row" />
      </div>
    </article>
  );
};

export const BentoArticleCard: React.FC<CardActionsProps & { tall?: boolean; className?: string }> = ({
  article,
  tall = false,
  className = '',
  onOpen,
  ...actions
}) => {
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
};
