import React, { useRef, useState } from 'react';
import { Bookmark, Check, Heart, ListPlus, Play, ThumbsDown } from 'lucide-react';
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

export interface CardActionsProps {
  article: NewsArticle;
  isBookmarked: boolean;
  isLiked: boolean;
  inQueue?: boolean;
  isRead?: boolean;
  readingProgress?: number;
  onOpen: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleQueue?: (article: NewsArticle) => void;
  onDismissLessLikeThis?: (article: NewsArticle) => void;
}

export const CATEGORY_TEXT_STYLES: Record<string, string> = {
  Politik: 'text-rose-700 dark:text-rose-400',
  Wirtschaft: 'text-emerald-700 dark:text-emerald-400',
  Technologie: 'text-sky-700 dark:text-sky-400',
  Wissenschaft: 'text-indigo-700 dark:text-indigo-400',
  Europa: 'text-blue-700 dark:text-blue-400',
  Gesellschaft: 'text-amber-700 dark:text-amber-400',
  Kultur: 'text-purple-700 dark:text-purple-400',
  Sport: 'text-orange-700 dark:text-orange-400',
};

export function ArticleActions({ article, isBookmarked, isLiked, inQueue = false, onToggleBookmark, onToggleLike, onToggleQueue, onDismissLessLikeThis, layout = 'row' }:
  Omit<CardActionsProps, 'onOpen' | 'isRead' | 'readingProgress'> & { layout?: 'column' | 'row' | 'overlay' }) {
  const { t } = useI18n();
  const overlay = layout === 'overlay';
  const style = overlay
    ? 'bg-black/48 text-white ring-1 ring-white/22 backdrop-blur-md hover:bg-black/68'
    : 'text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]';
  const position = { column: 'flex flex-col', row: 'flex items-center gap-0', overlay: 'absolute bottom-3 right-3 z-20 flex gap-1.5' };
  const sizeClass = overlay ? 'h-10 w-10' : 'h-9 w-9 sm:h-10 sm:w-10';
  const buttonStyle = `reaction-btn flex ${sizeClass} items-center justify-center rounded-full ${style}`;
  return (
    <div className={`${position[layout]} -mr-1.5 shrink-0 items-center`}>
      {onDismissLessLikeThis && !overlay && (
        <button
          type="button"
          className={`${buttonStyle} hidden md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity`}
          onClick={() => onDismissLessLikeThis(article)}
          aria-label={`${t('swipeLessLikeThis')}: ${article.title}`}
          title={t('swipeLessLikeThis')}
        >
          <ThumbsDown size={14} aria-hidden="true" />
        </button>
      )}
      {onToggleQueue && !overlay && (
        <button
          type="button"
          className={buttonStyle}
          data-active={inQueue || undefined}
          onClick={() => onToggleQueue(article)}
          aria-pressed={inQueue}
          aria-label={`${inQueue ? t('readerQueueAdded') : t('readerQueueAdd')}: ${article.title}`}
          title={inQueue ? t('readerQueueAdded') : t('readerQueueAdd')}
        >
          {inQueue ? (
            <Check size={15} className="text-[var(--accent)]" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <ListPlus size={15} aria-hidden="true" />
          )}
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
          size={16}
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
          size={16}
          className={isBookmarked ? 'fill-current text-[var(--accent)]' : undefined}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/**
 * Zero-rerender horizontal swipe-to-dismiss wrapper: drives GPU transform and backdrop cues
 * directly through DOM refs during touchmove for butter-smooth 60/120fps drag physics.
 */
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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const leftLabelRef = useRef<HTMLSpanElement>(null);
  const rightLabelRef = useRef<HTMLSpanElement>(null);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const offsetRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; dx: number; time: number; axis: SwipeAxis; buzzed: boolean } | null>(null);
  const [backdropVisible, setBackdropVisible] = useState(false);
  const [dismissingDir, setDismissingDir] = useState<-1 | 0 | 1>(0);

  React.useEffect(() => () => window.clearTimeout(dismissTimerRef.current), []);

  if (!enabled || !onDismiss) {
    return <>{children}</>;
  }

  const applyTransform = (x: number, draggingNow: boolean, readyNow: boolean) => {
    offsetRef.current = x;
    const surface = surfaceRef.current;
    if (surface) {
      if (draggingNow) surface.dataset.dragging = 'true';
      else delete surface.dataset.dragging;
      surface.style.transform = x !== 0 ? `translate3d(${x}px, 0, 0)` : '';
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.dataset.ready = readyNow ? 'true' : 'false';
    }
    if (leftLabelRef.current) {
      leftLabelRef.current.style.opacity = x > 12 ? '1' : '0';
    }
    if (rightLabelRef.current) {
      rightLabelRef.current.style.opacity = x < -12 ? '1' : '0';
    }
  };

  const reset = () => {
    touchRef.current = null;
    applyTransform(0, false, false);
    setBackdropVisible(false);
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
          if (offsetRef.current !== 0) reset();
          return;
        }
        if (move.axis === 'horizontal') {
          if (!backdropVisible) setBackdropVisible(true);
          applyTransform(move.offsetX, true, move.pastThreshold);
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
          if (offsetRef.current !== 0 || backdropVisible) reset();
          else touchRef.current = null;
          return;
        }
        const width = shellRef.current?.clientWidth || 360;
        const elapsed = performance.now() - state.time;
        if (shouldCommitSwipe(state.dx, elapsed, width)) {
          const dir = state.dx < 0 ? -1 : 1;
          touchRef.current = null;
          setDismissingDir(dir);
          applyTransform(dir * (width + 40), false, true);
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
      {(backdropVisible || dismissingDir !== 0) && (
        <div ref={backdropRef} className="swipe-card-backdrop" data-ready={dismissingDir !== 0 ? 'true' : 'false'} aria-hidden="true">
          <span ref={leftLabelRef} className="inline-flex items-center gap-2 text-xs font-bold transition-opacity duration-150" style={{ opacity: 0 }}>
            <ThumbsDown size={15} />
            {t('swipeLessLikeThis')}
          </span>
          <span ref={rightLabelRef} className="inline-flex items-center gap-2 text-xs font-bold transition-opacity duration-150" style={{ opacity: 0 }}>
            {t('swipeLessLikeThis')}
            <ThumbsDown size={15} />
          </span>
        </div>
      )}
      <div
        ref={surfaceRef}
        className="swipe-card-surface"
        data-dismissing={dismissingDir !== 0 || undefined}
        onClickCapture={event => {
          if (Math.abs(offsetRef.current) > 10 || dismissingDir !== 0) {
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

export const HeadlineArticleCard: React.FC<CardActionsProps & { lead?: boolean }> = React.memo(function HeadlineArticleCard({ article, lead = false, isRead = false, readingProgress, onOpen, ...actions }) {
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
  const progressPct = readingProgress && readingProgress >= 0.12 && readingProgress < 0.92
    ? Math.round(readingProgress * 100)
    : 0;

  return (
    <article className={`settings-group article-card article-card-interactive relative min-w-0 overflow-hidden ${lead ? 'article-card-lead' : ''}`}>
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
      >
        {article.imageUrl && (
          <div className={`article-thumbnail relative w-full overflow-hidden bg-[var(--control)] ${lead ? 'aspect-[16/9] max-h-[21.5rem]' : 'aspect-[16/9] sm:aspect-[2.15] max-h-[19rem]'}`}>
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
        <div className={`${lead ? 'px-4 pt-3.5 sm:px-6 sm:pt-5' : 'px-4 pt-3.5 sm:px-5 sm:pt-4'}`}>
          <p className={`text-[11.5px] font-bold tracking-[0.02em] ${categoryColor}`}>
            {kicker}
          </p>
          <Heading
            className={`mt-1.5 font-extrabold tracking-[-0.026em] [overflow-wrap:anywhere] [text-wrap:balance] transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-80 ${
              isRead && !progressPct ? 'text-[var(--ink)]/70' : 'text-[var(--ink)]'
            } ${
              lead
                ? 'text-[clamp(1.38rem,4.4vw,1.95rem)] leading-[1.14]'
                : 'text-[clamp(1.16rem,3.8vw,1.48rem)] leading-[1.18]'
            }`}
          >
            {article.title}
          </Heading>
          {clickbait.isClickbait && clickbait.clarifiedLead ? (
            <p className="mt-2 max-w-[65ch] text-[13.5px] leading-[1.52] text-[var(--ink-soft,var(--muted))]">
              <span className="font-semibold text-[var(--accent)]">{t('clickbaitShort')}: </span>
              {clickbait.clarifiedLead}
            </p>
          ) : article.summary && (
            <p className={`mt-2 line-clamp-3 max-w-[65ch] text-[var(--muted)] ${lead ? 'text-[14px] leading-[1.55] sm:text-[15px]' : 'text-[13.5px] leading-[1.5] sm:text-[14.5px]'}`}>
              {article.summary}
            </p>
          )}
        </div>
      </button>
      <div className={`mt-2 flex items-center justify-between gap-x-2 border-t border-[var(--line)]/65 pt-1.5 pb-1.5 ${lead ? 'mx-4 sm:mx-6' : 'mx-4 sm:mx-5'}`}>
        <div className="flex min-w-0 items-center gap-1.5 py-1 text-xs leading-snug text-[var(--muted)] tabular-nums">
          <SourceIcon
            source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
            size="h-4 w-4 shrink-0 rounded-[4px] text-[7px]"
          />
          <span className="truncate font-semibold text-[var(--ink)]">{article.sourceName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 whitespace-nowrap">{formatRelative(article.publishedAt)}</span>
          {article.readingTimeMin > 0 && (
            <span className="hidden sm:inline shrink-0 whitespace-nowrap">
              <span aria-hidden="true">· </span>
              {t('briefingReadMin', { min: article.readingTimeMin })}
            </span>
          )}
          {progressPct > 0 ? (
            <span className="shrink-0 whitespace-nowrap font-semibold text-[var(--accent)]">
              <span aria-hidden="true">· </span>
              {progressPct}%
            </span>
          ) : isRead ? (
            <span className="hidden sm:inline shrink-0 whitespace-nowrap">
              <span aria-hidden="true">· </span>
              {t('readLabel')}
            </span>
          ) : null}
        </div>
        <ArticleActions article={article} {...actions} layout="row" />
      </div>
      {progressPct > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-[var(--control)]" aria-hidden="true">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </article>
  );
});

export const CompactArticleCard: React.FC<CardActionsProps> = React.memo(({
  article,
  isRead = false,
  readingProgress,
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
  const progressPct = readingProgress && readingProgress >= 0.12 && readingProgress < 0.92
    ? Math.round(readingProgress * 100)
    : 0;

  return (
    <article className="liquid-glass article-card article-card-compact article-card-interactive group relative flex flex-col justify-between overflow-hidden p-3 sm:p-3.5">
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="flex min-w-0 w-full items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl"
        aria-label={`${t('openArticle')}: ${article.title}`}
      >
        <div className="article-thumbnail relative h-[76px] w-[76px] sm:h-[84px] sm:w-[112px] shrink-0 overflow-hidden rounded-[12px] bg-[var(--control)]">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            sourceShortCode={article.sourceShortCode}
            sourceColor={article.sourceColor}
            className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.035]"
          />
          {(article.videoUrl || article.youtubeId) && (
            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-[11px] font-bold tracking-[0.02em] ${categoryColor}`}>
            {kicker}
          </p>
          <h3 className={`mt-0.5 line-clamp-3 [overflow-wrap:anywhere] text-[14.5px] sm:text-[15px] font-bold leading-[1.3] tracking-[-0.015em] [text-wrap:balance] transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-80 ${
            isRead && !progressPct ? 'text-[var(--ink)]/70' : 'text-[var(--ink)]'
          }`}>
            {article.title}
          </h3>
        </div>
      </button>

      <div className="mt-2 flex items-center justify-between gap-2 pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)] tabular-nums">
          <SourceIcon
            source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
            size="h-4 w-4 shrink-0 rounded-[4px] text-[7px]"
          />
          <span className="truncate font-medium text-[var(--ink)]/85">
            {article.sourceName}
          </span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 whitespace-nowrap">{formatRelative(article.publishedAt)}</span>
          {article.readingTimeMin > 0 && (
            <span className="hidden sm:inline shrink-0 whitespace-nowrap">
              <span aria-hidden="true">· </span>
              {t('briefingReadMin', { min: article.readingTimeMin })}
            </span>
          )}
          {progressPct > 0 ? (
            <span className="shrink-0 whitespace-nowrap font-semibold text-[var(--accent)]">
              <span aria-hidden="true">· </span>
              {progressPct}%
            </span>
          ) : isRead ? (
            <span className="hidden sm:inline shrink-0 whitespace-nowrap">
              <span aria-hidden="true">· </span>
              {t('readLabel')}
            </span>
          ) : null}
        </div>
        <ArticleActions article={article} {...actions} layout="row" />
      </div>
      {progressPct > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-[var(--control)]" aria-hidden="true">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </article>
  );
});
