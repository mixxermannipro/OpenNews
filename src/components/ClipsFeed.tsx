import { Capacitor, SystemBars } from '@capacitor/core';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Heart,
  Play,
  Repeat,
  Share2,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeHref } from '../lib/contentIdentity';
import type { NewsArticle } from '../types/news';
import {
  buildClipsPlaylist,
  getClipRenderState,
  resolveClipStep,
  type ClipsFeedMode,
  type MediaEntry,
} from '../lib/clipsEngine';
import { useI18n } from '../lib/i18n';
import { shareArticle } from '../lib/shareArticle';
import { ArticleImage } from './ArticleImage';
import { MediaPlayer } from './MediaPlayer';
import { SourceIcon } from './SourceIcon';

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

export function ClipsFeed({
  entries,
  initialUrl,
  loading,
  liked,
  saved,
  onClose,
  onArticle,
  onSources,
  onLike,
  onSave,
  onEngaged,
}: {
  entries: MediaEntry[];
  initialUrl?: string;
  loading: boolean;
  liked: string[];
  saved: string[];
  onClose: () => void;
  onArticle: (article: NewsArticle) => void;
  onSources: () => void;
  onLike: (article: NewsArticle) => void;
  onSave: (article: NewsArticle) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
}) {
  const { t, formatRelative } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const paneRef = useRef<HTMLUListElement>(null);
  const exitActionRef = useRef<(() => void) | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedRef = useRef(false);
  const pushedHistoryRef = useRef(false);

  const [mode, setMode] = useState<ClipsFeedMode>('shorts');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [progress, setProgress] = useState(0);
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [bursts, setBursts] = useState<HeartBurst[]>([]);
  const [showHint, setShowHint] = useState(true);

  const playlist = useMemo(() => buildClipsPlaylist(entries, mode, true), [entries, mode]);
  const items = playlist.items;
  const hasLandscapeVideos = useMemo(
    () => entries.some(({ media }) => !media.portrait && media.type !== 'audio'),
    [entries],
  );

  const requestClose = useCallback((after?: () => void) => {
    if (closedRef.current) return;
    closedRef.current = true;
    exitActionRef.current = after;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      if (after) {
        const nextState = { ...(window.history.state ?? {}) };
        delete nextState.opennewsClips;
        window.history.replaceState(nextState, '');
      } else {
        window.history.back();
      }
    }
    onCloseRef.current();
    const pending = exitActionRef.current;
    exitActionRef.current = undefined;
    pending?.();
  }, []);

  // Sync modal lifecycle + Android system bars + history back (run strictly once per mount)
  useEffect(() => {
    const dialog = dialogRef.current;
    closedRef.current = false;
    dialog?.showModal();
    paneRef.current?.focus({ preventScroll: true });
    if (Capacitor.isNativePlatform()) void SystemBars.hide().catch(() => {});
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ ...(window.history.state ?? {}), opennewsClips: true }, '');
    pushedHistoryRef.current = true;

    const handlePop = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      pushedHistoryRef.current = false;
      onCloseRef.current();
      const pending = exitActionRef.current;
      exitActionRef.current = undefined;
      pending?.();
    };
    const handleNativeCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    const handleNativeClose = () => {
      requestClose();
    };
    window.addEventListener('popstate', handlePop);
    dialog?.addEventListener('cancel', handleNativeCancel);
    dialog?.addEventListener('close', handleNativeClose);
    return () => {
      window.removeEventListener('popstate', handlePop);
      dialog?.removeEventListener('cancel', handleNativeCancel);
      dialog?.removeEventListener('close', handleNativeClose);
      document.body.style.overflow = originalOverflow;
      if (dialog?.open) dialog.close();
      if (Capacitor.isNativePlatform()) void SystemBars.show().catch(() => {});
    };
  }, [requestClose]);

  // Hide initial swipe hint after 3.5s
  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(false), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  // Scroll to initial clip when opened from a specific preview tile
  useEffect(() => {
    if (!initialUrl || !items.length) return;
    const idx = items.findIndex(({ media }) => media.url === initialUrl);
    if (idx >= 0) {
      setActiveIndex(idx);
      const pane = paneRef.current;
      if (pane) pane.scrollTo({ top: idx * pane.clientHeight, behavior: 'instant' });
    }
  }, [initialUrl, items]);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, nextIndex));
      const pane = paneRef.current;
      if (pane) {
        pane.scrollTo({ top: clamped * pane.clientHeight, behavior: 'smooth' });
      }
      setActiveIndex(clamped);
      setProgress(0);
      setShowHint(false);
    },
    [items.length],
  );

  // Track currently snapped slide via IntersectionObserver
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !items.length) return;
    const observer = new IntersectionObserver(
      changes => {
        const visible = changes.find(change => change.intersectionRatio >= 0.6);
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.clipIndex);
          if (Number.isFinite(idx)) {
            setActiveIndex(idx);
            setProgress(0);
            if (idx > 0) setShowHint(false);
          }
        }
      },
      { root: pane, threshold: 0.6 },
    );
    for (const child of pane.children) observer.observe(child);
    return () => observer.disconnect();
  }, [items]);

  // Keyboard shortcuts (TikTok / YouTube Shorts desktop ergonomics)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      } else if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        scrollToIndex(resolveClipStep(activeIndex, 1, items.length));
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        scrollToIndex(resolveClipStep(activeIndex, -1, items.length));
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setMuted(value => !value);
      } else if ((event.key === 'l' || event.key === 'L') && items[activeIndex]) {
        event.preventDefault();
        onLike(items[activeIndex].article);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeIndex, items, onLike, requestClose, scrollToIndex]);

  const triggerHeartBurst = (article: NewsArticle, coords: { x: number; y: number }) => {
    if (!liked.includes(article.id)) onLike(article);
    const id = Date.now() + Math.random();
    setBursts(prev => [...prev, { id, x: coords.x, y: coords.y }]);
    window.setTimeout(() => {
      setBursts(prev => prev.filter(item => item.id !== id));
    }, 750);
  };

  const handleShare = (article: NewsArticle, mediaUrl: string) => {
    setShareFeedback('');
    void shareArticle(article, article.linkIsFeed ? mediaUrl : article.link)
      .then(copied => {
        if (copied) {
          setShareFeedback(t('linkCopied'));
          window.setTimeout(() => setShareFeedback(''), 2200);
        }
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setShareFeedback(t('shareUnavailable'));
          window.setTimeout(() => setShareFeedback(''), 2200);
        }
      });
  };

  const activeEntry = items[activeIndex];

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={t('mediaFilterClips')}
      className="clips-dialog fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-black text-white"
      onCancel={event => {
        event.preventDefault();
        requestClose();
      }}
    >
      {/* Desktop ambient backdrop derived from current clip thumbnail */}
      {activeEntry?.article.imageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 hidden scale-110 bg-cover bg-center opacity-25 blur-3xl transition-opacity duration-500 md:block"
          style={{ backgroundImage: `url(${activeEntry.article.imageUrl})` }}
        />
      )}

      {/* Top floating minimal HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 sm:px-6">
        <button
          type="button"
          onClick={() => requestClose()}
          aria-label={t('close')}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition-transform hover:bg-black/75 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        {playlist.hasDedicatedShorts && hasLandscapeVideos && (
          <div
            role="group"
            aria-label={t('mediaFilterClips')}
            className="pointer-events-auto flex items-center rounded-full border border-white/15 bg-black/55 p-1 backdrop-blur-md"
          >
            <button
              type="button"
              aria-pressed={mode === 'shorts'}
              onClick={() => {
                setMode('shorts');
                setActiveIndex(0);
                paneRef.current?.scrollTo({ top: 0, behavior: 'instant' });
              }}
              className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'shorts' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              {t('mediaClipsShortsOnly')}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'all-video'}
              onClick={() => {
                setMode('all-video');
                setActiveIndex(0);
                paneRef.current?.scrollTo({ top: 0, behavior: 'instant' });
              }}
              className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'all-video' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              {t('mediaClipsAllVideos')}
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          {items.length > 0 && (
            <span className="text-xs font-semibold tabular-nums text-white/80 drop-shadow">
              {activeIndex + 1} / {items.length}
            </span>
          )}
        </div>
      </div>

      {/* Share toast */}
      {shareFeedback && (
        <p
          role="status"
          className="fixed top-[calc(4.25rem+env(safe-area-inset-top))] left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md"
        >
          {shareFeedback}
        </p>
      )}

      {/* Desktop right-edge Up/Down navigation buttons (YouTube Shorts / TikTok style) */}
      {items.length > 1 && (
        <div className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button
            type="button"
            disabled={activeIndex <= 0}
            aria-label={t('mediaClipsPrev')}
            onClick={() => scrollToIndex(activeIndex - 1)}
            className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-30"
          >
            <ChevronUp className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={activeIndex >= items.length - 1}
            aria-label={t('mediaClipsNext')}
            onClick={() => scrollToIndex(activeIndex + 1)}
            className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-30"
          >
            <ChevronDown className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Vertical Snap Scroller */}
      {items.length > 0 ? (
        <ul
          ref={paneRef}
          tabIndex={0}
          aria-label={t('mediaFilterClips')}
          className="clips-scroller relative z-10 h-full w-full snap-y snap-mandatory overflow-y-auto touch-pan-y overscroll-y-contain"
        >
          {items.map(({ article, media }, idx) => {
            const renderState = getClipRenderState(idx, activeIndex);
            const isActive = renderState === 'active';
            const isLiked = liked.includes(article.id);
            const isSaved = saved.includes(article.id);
            const isYouTube = media.type === 'youtube';
            const isExpanded = expandedCaption === article.id;

            return (
              <li
                key={media.url}
                data-clip-index={idx}
                data-media-url={media.url}
                className="relative flex h-dvh w-full snap-start snap-always items-center justify-center md:pt-16 md:pb-5"
              >
                {/* Stage wrapper: full-bleed on mobile; 9:16 card + external right Action Rail on desktop */}
                <div className="relative flex h-full w-full items-center justify-center md:h-auto md:w-auto md:items-end md:gap-4">
                  <div className={`clips-stage relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:h-[min(calc(100dvh-5.5rem),50rem)] md:w-auto md:rounded-[28px] md:border md:border-white/15 md:shadow-2xl ${isYouTube ? "md:min-w-[calc(200px_+_2px)]" : ""}`}>
                  {/* Video / YouTube Layer */}
                  <div
                    className={
                      isYouTube && isActive
                        ? 'absolute inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(9.5rem+env(safe-area-inset-bottom))] bg-black md:top-0 md:bottom-[clamp(0px,calc(100%_-_200px),9rem)]'
                        : 'absolute inset-0 bg-black'
                    }
                  >
                    {isActive ? (
                      <MediaPlayer
                        media={media}
                        title={article.title}
                        poster={article.imageUrl}
                        background={false}
                        clip
                        autoPlay
                        muted={muted}
                        autoAdvance={autoAdvance}
                        onToggleMute={() => setMuted(v => !v)}
                        onDoubleTapLike={coords => triggerHeartBurst(article, coords)}
                        onProgress={setProgress}
                        onClipEnded={() => {
                          if (activeIndex < items.length - 1) {
                            scrollToIndex(activeIndex + 1);
                          }
                        }}
                        onEngaged={seconds => onEngaged(article, seconds)}
                      />
                    ) : (
                      <div className="relative h-full w-full bg-black">
                        {renderState === 'nearby' && article.imageUrl && (
                          <ArticleImage
                            src={article.imageUrl}
                            alt=""
                            sourceShortCode={article.sourceShortCode}
                            sourceColor={article.sourceColor}
                            className="h-full w-full object-cover opacity-85"
                          />
                        )}
                        <div className="absolute inset-0 grid place-items-center">
                          <span className="grid size-14 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
                            <Play className="h-6 w-6 translate-x-0.5 text-white" fill="currentColor" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Double-tap heart burst animations */}
                  {isActive &&
                    bursts.map(burst => (
                      <span
                        key={burst.id}
                        aria-hidden="true"
                        className="clips-heart-burst pointer-events-none absolute z-30"
                        style={{ left: burst.x, top: burst.y }}
                      >
                        <Heart className="h-20 w-20 fill-rose-500 text-rose-500 drop-shadow-lg" />
                      </span>
                    ))}

                  {/* Bottom Editorial Scrim & Caption */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/75 to-transparent px-4 pt-14 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pr-20 md:pr-4 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <span className="font-semibold text-white">{article.sourceName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelative(article.publishedAt)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestClose(() => onArticle(article))}
                      className={`mt-1 block text-left text-[15px] font-bold leading-snug text-white [overflow-wrap:anywhere] ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      {article.title}
                    </button>

                    {article.summary && article.summary.trim() !== article.title.trim() && (
                      <div className="mt-1">
                        {isExpanded && (
                          <p className="text-xs leading-relaxed text-white/80 line-clamp-4">{article.summary}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedCaption(isExpanded ? null : article.id)}
                          className="mt-0.5 text-xs font-semibold text-white/75 hover:text-white"
                        >
                          {isExpanded ? t('mediaLessCaption') : t('mediaMoreCaption')}
                        </button>
                      </div>
                    )}

                    {(isYouTube || (showHint && idx === 0 && items.length > 1)) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {isYouTube && safeHref(article.link) && (
                          <a
                            href={safeHref(article.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-white/75 hover:text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('mediaWatchYoutube')}
                          </a>
                        )}

                        {showHint && idx === 0 && items.length > 1 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/65 md:hidden">
                            <ChevronUp className="h-3.5 w-3.5 animate-bounce" aria-hidden="true" />
                            {t('mediaClipsSwipeHint')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hairline bottom playback progress bar (TikTok / Reels style for direct video) */}
                  {isActive && !isYouTube && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[3px] bg-white/20"
                    >
                      <div
                        className="h-full origin-left bg-white transition-transform duration-150"
                        style={{ transform: `scaleX(${progress})` }}
                      />
                    </div>
                  )}
                  </div>

                  {/* Instagram Reels / TikTok Right-Side Vertical Action Rail (overlaid on mobile, cleanly outside card on desktop) */}
                  <div
                    className="absolute right-2.5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2.5 md:static md:mb-3 md:gap-3.5"
                    aria-label={t('readerMoreActions')}
                  >
                    <button
                      type="button"
                      onClick={() => requestClose(() => onArticle(article))}
                      aria-label={`${article.sourceName} – ${t('mediaClipsArticle')}`}
                      className="clips-rail-avatar relative rounded-full p-0.5 ring-2 ring-white/80 transition-transform active:scale-90"
                    >
                      <SourceIcon
                        source={{
                          id: article.sourceId,
                          shortCode: article.sourceShortCode,
                          accentColor: article.sourceColor,
                        }}
                        size="h-10 w-10"
                        rounded="rounded-full"
                      />
                    </button>

                    <button
                      type="button"
                      data-clip-action="like"
                      aria-pressed={isLiked}
                      aria-label={isLiked ? t('unlike') : t('like')}
                      onClick={() => onLike(article)}
                      className="clips-rail-btn flex flex-col items-center gap-1"
                    >
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                          isLiked ? 'bg-rose-500/90 text-white' : 'bg-black/50 text-white hover:bg-black/70 md:bg-white/12 md:hover:bg-white/20'
                        }`}
                      >
                        <Heart className="h-5 w-5" fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-medium text-white/90 drop-shadow">{t('like')}</span>
                    </button>

                    <button
                      type="button"
                      data-clip-action="save"
                      aria-pressed={isSaved}
                      aria-label={isSaved ? t('unbookmark') : t('bookmark')}
                      onClick={() => onSave(article)}
                      className="clips-rail-btn flex flex-col items-center gap-1"
                    >
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                          isSaved ? 'bg-amber-400 text-black' : 'bg-black/50 text-white hover:bg-black/70 md:bg-white/12 md:hover:bg-white/20'
                        }`}
                      >
                        <Bookmark className="h-5 w-5" fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-medium text-white/90 drop-shadow">{t('saveShort')}</span>
                    </button>

                    <button
                      type="button"
                      aria-label={t('mediaClipsArticle')}
                      onClick={() => requestClose(() => onArticle(article))}
                      className="clips-rail-btn flex flex-col items-center gap-1"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform hover:bg-black/70 active:scale-90 md:bg-white/12 md:hover:bg-white/20">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-medium text-white/90 drop-shadow">{t('mediaClipsArticle')}</span>
                    </button>

                    <button
                      type="button"
                      aria-label={t('share')}
                      onClick={() => handleShare(article, media.url)}
                      className="clips-rail-btn flex flex-col items-center gap-1"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform hover:bg-black/70 active:scale-90 md:bg-white/12 md:hover:bg-white/20">
                        <Share2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-medium text-white/90 drop-shadow">{t('share')}</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={muted}
                      aria-label={muted ? t('mediaClipsUnmute') : t('mediaClipsMute')}
                      onClick={() => setMuted(value => !value)}
                      className="clips-rail-btn grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform hover:bg-black/70 active:scale-90 md:bg-white/12 md:hover:bg-white/20"
                    >
                      {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
                    </button>

                    {!isYouTube && (
                      <button
                        type="button"
                        aria-pressed={autoAdvance}
                        aria-label={t('mediaClipsAutoNext')}
                        onClick={() => setAutoAdvance(v => !v)}
                        className={`clips-rail-btn grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                          autoAdvance ? 'bg-white text-black' : 'bg-black/50 text-white md:bg-white/12'
                        }`}
                      >
                        {autoAdvance ? <SkipForward className="h-5 w-5" aria-hidden="true" /> : <Repeat className="h-5 w-5" aria-hidden="true" />}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="relative z-10 grid h-full place-content-center gap-4 p-6 text-center">
          <p role="status" className="text-base text-white/85">
            {loading ? t('mediaLoading') : t('mediaEmptyNoSources')}
          </p>
          {!loading && (
            <button
              type="button"
              className="mx-auto min-h-[44px] rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
              onClick={() => requestClose(onSources)}
            >
              {t('mediaManageSources')}
            </button>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  );
}
