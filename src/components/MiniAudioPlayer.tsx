import { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react';
import type { PlayableMedia } from '../lib/articleMedia';
import { useI18n } from '../lib/i18n';
import type { NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';

export interface ActiveAudioTrack {
  article: NewsArticle;
  media: PlayableMedia;
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MiniAudioPlayer({
  track,
  initialSeconds = 0,
  background,
  onSavePosition,
  onEngaged,
  onOpenArticle,
  onClose,
}: {
  track: ActiveAudioTrack;
  initialSeconds?: number;
  background: boolean;
  onSavePosition: (url: string, seconds: number, duration: number) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialSeconds);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const lastSavedRef = useRef(0);
  const engagedRef = useRef(false);
  const playStartRef = useRef<number | null>(null);

  const speed = SPEEDS[speedIndex];
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    engagedRef.current = false;
    lastSavedRef.current = 0;
    setCurrentTime(initialSeconds);
    setDuration(0);
    setPlaying(false);
    const el = audioRef.current;
    if (!el) return;

    const handleLoaded = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      setDuration(dur);
      if (initialSeconds > 3 && (!dur || initialSeconds < dur - 5)) {
        try {
          el.currentTime = initialSeconds;
          setCurrentTime(initialSeconds);
        } catch {
          // Ignore seek errors on unbuffered streams
        }
      }
      el.playbackRate = speed;
      void el.play().catch(() => {});
    };

    const handlePlay = () => {
      setPlaying(true);
      playStartRef.current = Date.now();
    };
    const handlePause = () => {
      setPlaying(false);
      if (playStartRef.current && !engagedRef.current) {
        const secs = Math.round((Date.now() - playStartRef.current) / 1000);
        if (secs >= 5) {
          engagedRef.current = true;
          onEngaged(track.article, secs);
        }
      }
      playStartRef.current = null;
      onSavePosition(track.media.url, el.currentTime, el.duration || duration);
    };
    const handleTime = () => {
      setCurrentTime(el.currentTime);
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
      const now = Date.now();
      if (now - lastSavedRef.current >= 3000) {
        lastSavedRef.current = now;
        onSavePosition(track.media.url, el.currentTime, el.duration || 0);
      }
    };
    const handleEnded = () => {
      setPlaying(false);
      onSavePosition(track.media.url, el.duration || currentTime, el.duration || currentTime);
    };

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('timeupdate', handleTime);
    el.addEventListener('ended', handleEnded);

    return () => {
      onSavePosition(track.media.url, el.currentTime, el.duration || 0);
      el.pause();
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('timeupdate', handleTime);
      el.removeEventListener('ended', handleEnded);
    };
  }, [track.media.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (background) return;
    const onHide = () => {
      if (document.hidden) audioRef.current?.pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [background]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.article.title,
      artist: track.article.sourceName,
      artwork: track.article.imageUrl ? [{ src: track.article.imageUrl }] : undefined,
    });
    const seekBy = (delta: number) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
    };
    navigator.mediaSession.setActionHandler('play', () => { void audioRef.current?.play().catch(() => {}); });
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(30));
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
    };
  }, [track]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const seekBy = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
    setCurrentTime(el.currentTime);
  };

  return (
    <aside
      aria-label={t('mediaNowPlaying')}
      className="mini-audio-player"
    >
      <audio
        ref={audioRef}
        src={track.media.url}
        preload="metadata"
        playsInline
      />

      {/* Top hairline progress */}
      <div className="h-[3px] w-full bg-[var(--control)]">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onOpenArticle(track.article)}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-900 text-white"
          aria-label={`${t('openArticle')}: ${track.article.title}`}
        >
          {track.article.imageUrl ? (
            <ArticleImage
              src={track.article.imageUrl}
              alt=""
              sourceShortCode={track.article.sourceShortCode}
              sourceColor={track.article.sourceColor}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center">
              <Headphones size={18} aria-hidden="true" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenArticle(track.article)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[13px] font-bold leading-tight text-[var(--ink)]">
            {track.article.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)] tabular-nums">
            <span className="truncate font-medium">{track.article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {formatAudioClock(currentTime)}{duration > 0 ? ` / ${formatAudioClock(duration)}` : ''}
            </span>
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => seekBy(-15)}
            aria-label={t('mediaAudioBack15')}
            className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? t('mediaClipsPause') : t('mediaClipsPlay')}
            className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm transition active:scale-95"
          >
            {playing ? (
              <Pause size={17} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={17} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => seekBy(30)}
            aria-label={t('mediaAudioForward30')}
            className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
          >
            <RotateCw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSpeedIndex(i => (i + 1) % SPEEDS.length)}
            aria-label={t('mediaAudioSpeed')}
            className="grid h-10 min-w-[2.5rem] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums text-[var(--ink)] transition hover:bg-[var(--control)]"
          >
            {speed}×
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('miniPlayerClose')}
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
