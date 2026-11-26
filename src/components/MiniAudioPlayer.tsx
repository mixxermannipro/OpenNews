import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Headphones, Moon, Pause, Play, Radio, RotateCcw, RotateCw, SkipForward, X } from 'lucide-react';
import type { PlayableMedia } from '../lib/articleMedia';
import { safeHref } from '../lib/contentIdentity';
import { useI18n } from '../lib/i18n';
import { getMediaCopy } from '../lib/mediaCopy';
import {
  addNativeAudioListener,
  isNativeAudioAvailable,
  pauseNativeAudio,
  playNativeAudio,
  resumeNativeAudio,
  seekNativeAudio,
  seekNativeAudioBy,
  setNativeAudioSpeed,
  stopNativeAudio,
  type NativeAudioPlaybackState,
} from '../lib/nativeAudio';
import type { NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';

export interface ActiveAudioTrack {
  article: NewsArticle;
  media: PlayableMedia;
  isLive?: boolean;
  radioStation?: {
    id: string;
    region: string;
    accentColor: string;
    shortCode: string;
    subtitle: string;
  };
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;
type SleepTimerChoice = null | 15 | 30 | 45 | 'end-of-episode';
const EPISODE_SLEEP_CHOICES: readonly SleepTimerChoice[] = [null, 15, 30, 45, 'end-of-episode'];
const LIVE_SLEEP_CHOICES: readonly SleepTimerChoice[] = [null, 15, 30, 45];

export function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MiniAudioPlayer({
  track,
  initialSeconds = 0,
  background,
  nextTrack,
  onNextTrack,
  onSavePosition,
  onEngaged,
  onOpenArticle,
  onClose,
}: {
  track: ActiveAudioTrack;
  initialSeconds?: number;
  background: boolean;
  nextTrack?: ActiveAudioTrack;
  onNextTrack?: () => void;
  onSavePosition: (url: string, seconds: number, duration: number) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const copy = getMediaCopy(lang);
  const nativeMode = isNativeAudioAvailable();
  const audioRef = useRef<HTMLAudioElement>(null);
  const isLive = Boolean(track.isLive);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(isLive);
  const [audioError, setAudioError] = useState(false);
  const [currentTime, setCurrentTime] = useState(isLive ? 0 : initialSeconds);
  const [duration, setDuration] = useState(isLive ? 0 : (track.media.durationSec || track.article.durationSec || 0));
  const [speedIndex, setSpeedIndex] = useState(0);
  const [sleepChoice, setSleepChoice] = useState<SleepTimerChoice>(null);
  const [sleepRemainingMin, setSleepRemainingMin] = useState<number | null>(null);
  const sleepEndsAtRef = useRef<number | null>(null);
  const sleepChoiceRef = useRef<SleepTimerChoice>(sleepChoice);
  sleepChoiceRef.current = sleepChoice;
  const lastSavedRef = useRef(0);
  const engagedRef = useRef(false);
  const playStartRef = useRef<number | null>(null);
  const onNextTrackRef = useRef(onNextTrack);
  onNextTrackRef.current = onNextTrack;
  const onSavePositionRef = useRef(onSavePosition);
  onSavePositionRef.current = onSavePosition;
  const onEngagedRef = useRef(onEngaged);
  onEngagedRef.current = onEngaged;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const speed = isLive ? 1 : SPEEDS[speedIndex];
  const progress = !isLive && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    if (isLive && sleepChoice === 'end-of-episode') {
      setSleepChoice(null);
    }
  }, [isLive, sleepChoice]);

  useEffect(() => {
    if (typeof sleepChoice !== 'number') {
      sleepEndsAtRef.current = null;
      setSleepRemainingMin(null);
      return;
    }
    const endAt = Date.now() + sleepChoice * 60_000;
    sleepEndsAtRef.current = endAt;
    setSleepRemainingMin(sleepChoice);
    const id = window.setInterval(() => {
      const target = sleepEndsAtRef.current;
      if (!target) return;
      const remMs = target - Date.now();
      if (remMs <= 0) {
        window.clearInterval(id);
        sleepEndsAtRef.current = null;
        setSleepRemainingMin(null);
        setSleepChoice(null);
        if (nativeMode) {
          void pauseNativeAudio().catch(() => {});
        } else {
          audioRef.current?.pause();
        }
        return;
      }
      setSleepRemainingMin(Math.max(1, Math.ceil(remMs / 60_000)));
    }, 15_000);
    return () => window.clearInterval(id);
  }, [sleepChoice, nativeMode]);

  const cycleSleepTimer = () => {
    const choices = isLive ? LIVE_SLEEP_CHOICES : EPISODE_SLEEP_CHOICES;
    const idx = choices.indexOf(sleepChoice);
    const next = choices[(idx + 1) % choices.length];
    setSleepChoice(next);
  };

  useEffect(() => {
    engagedRef.current = false;
    lastSavedRef.current = 0;
    setAudioError(false);
    const initialDur = isLive ? 0 : (track.media.durationSec || track.article.durationSec || 0);
    const safeInitial = !isLive && initialDur > 0 && initialSeconds >= initialDur - 5 ? 0 : (isLive ? 0 : initialSeconds);
    setCurrentTime(safeInitial);
    setDuration(initialDur);
    setPlaying(false);
    setBuffering(isLive);

    if (nativeMode) {
      let active = true;
      let handlePromise: ReturnType<typeof addNativeAudioListener> | undefined;
      const applyNativeState = (state: NativeAudioPlaybackState) => {
        if (!active || (state.url && state.url !== track.media.url)) return;
        setPlaying(state.playing);
        setBuffering(state.buffering);
        setAudioError(state.error);
        if (!isLive) {
          setCurrentTime(state.currentTime);
          if (state.duration > 0) setDuration(state.duration);
          const now = Date.now();
          if (state.playing && now - lastSavedRef.current >= 3000) {
            lastSavedRef.current = now;
            onSavePositionRef.current(track.media.url, state.currentTime, state.duration || durationRef.current);
          }
        }
        if (state.playing && !playStartRef.current) {
          playStartRef.current = Date.now();
        } else if (!state.playing && playStartRef.current) {
          if (!engagedRef.current) {
            const secs = Math.round((Date.now() - playStartRef.current) / 1000);
            if (secs >= 5) {
              engagedRef.current = true;
              onEngagedRef.current(track.article, secs);
            }
          }
          playStartRef.current = null;
        }
        if (state.ended) {
          if (!isLive) {
            onSavePositionRef.current(track.media.url, state.duration || state.currentTime, state.duration || state.currentTime);
          }
          if (sleepChoiceRef.current === 'end-of-episode') {
            setSleepChoice(null);
            return;
          }
          if (onNextTrackRef.current) {
            onNextTrackRef.current();
          }
        }
      };

      handlePromise = addNativeAudioListener(applyNativeState);
      void playNativeAudio({
        url: track.media.url,
        title: track.article.title,
        artist: isLive ? `${track.article.sourceName} · ${copy.liveBadge}` : track.article.sourceName,
        artworkUrl: track.article.imageUrl,
        isLive,
        initialSeconds: safeInitial,
        speed: isLive ? 1 : SPEEDS[speedIndex],
        stationId: track.radioStation?.id,
      })
        .then(applyNativeState)
        .catch(() => {
          if (active) {
            setBuffering(false);
            setAudioError(true);
          }
        });

      return () => {
        active = false;
        if (!isLive) {
          onSavePositionRef.current(track.media.url, currentTimeRef.current, durationRef.current || 0);
        }
        void handlePromise?.then((h) => h.remove()).catch(() => {});
      };
    }

    const el = audioRef.current;
    if (!el) return;

    if (el.getAttribute('src') !== track.media.url) {
      el.setAttribute('src', track.media.url);
    }

    const handleLoaded = () => {
      setAudioError(false);
      if (isLive) {
        setDuration(0);
        el.playbackRate = 1;
        void el.play().catch(() => {});
        return;
      }
      const dur = Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : (track.media.durationSec || track.article.durationSec || 0);
      setDuration(dur);
      if (initialSeconds > 3 && (!dur || initialSeconds < dur - 5)) {
        try {
          el.currentTime = initialSeconds;
          setCurrentTime(initialSeconds);
        } catch {
          // Ignore seek errors on unbuffered streams
        }
      } else if (dur > 0 && initialSeconds >= dur - 5) {
        setCurrentTime(0);
      }
      el.playbackRate = speed;
      void el.play().catch(() => {});
    };

    const handleWaiting = () => {
      setBuffering(true);
    };
    const handleCanPlay = () => {
      setBuffering(false);
    };
    const handlePlay = () => {
      setAudioError(false);
      setBuffering(false);
      setPlaying(true);
      playStartRef.current = Date.now();
    };
    const handlePause = () => {
      setPlaying(false);
      setBuffering(false);
      if (playStartRef.current && !engagedRef.current) {
        const secs = Math.round((Date.now() - playStartRef.current) / 1000);
        if (secs >= 5) {
          engagedRef.current = true;
          onEngagedRef.current(track.article, secs);
        }
      }
      playStartRef.current = null;
      if (!isLive) {
        onSavePositionRef.current(track.media.url, el.currentTime, el.duration || duration);
      }
    };
    const handleTime = () => {
      if (isLive) return;
      setCurrentTime(el.currentTime);
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
      const now = Date.now();
      if (now - lastSavedRef.current >= 3000) {
        lastSavedRef.current = now;
        onSavePositionRef.current(track.media.url, el.currentTime, el.duration || 0);
      }
    };
    const handleEnded = () => {
      setPlaying(false);
      setBuffering(false);
      if (!isLive) {
        onSavePositionRef.current(track.media.url, el.duration || currentTime, el.duration || currentTime);
      }
      if (sleepChoiceRef.current === 'end-of-episode') {
        setSleepChoice(null);
        return;
      }
      if (onNextTrackRef.current) {
        onNextTrackRef.current();
      }
    };
    const handleError = () => {
      setPlaying(false);
      setBuffering(false);
      setAudioError(true);
    };

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('waiting', handleWaiting);
    el.addEventListener('canplay', handleCanPlay);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('timeupdate', handleTime);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('error', handleError);

    if (isLive) {
      el.load();
      void el.play().catch(() => {});
    }

    return () => {
      if (!isLive) {
        onSavePositionRef.current(track.media.url, el.currentTime, el.duration || 0);
      }
      el.pause();
      if (isLive) {
        el.removeAttribute('src');
        el.load();
      }
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('waiting', handleWaiting);
      el.removeEventListener('canplay', handleCanPlay);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('timeupdate', handleTime);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
    };
  }, [track.media.url, isLive, nativeMode]);

  useEffect(() => {
    if (nativeMode) {
      if (!isLive) void setNativeAudioSpeed(speed).catch(() => {});
      return;
    }
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, isLive, nativeMode]);

  useEffect(() => {
    if (background) return;
    const onHide = () => {
      if (!document.hidden) return;
      if (nativeMode) {
        void pauseNativeAudio().catch(() => {});
      } else {
        audioRef.current?.pause();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [background, nativeMode]);

  useEffect(() => {
    if (nativeMode || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.article.title,
      artist: isLive ? `${track.article.sourceName} · ${copy.liveBadge}` : track.article.sourceName,
      artwork: track.article.imageUrl ? [{ src: track.article.imageUrl }] : undefined,
    });
    const seekBy = (delta: number) => {
      const el = audioRef.current;
      if (!el || isLive) return;
      el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
    };
    navigator.mediaSession.setActionHandler('play', () => { void audioRef.current?.play().catch(() => {}); });
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', isLive ? null : () => seekBy(-15));
    navigator.mediaSession.setActionHandler('seekforward', isLive ? null : () => seekBy(30));
    navigator.mediaSession.setActionHandler('nexttrack', !isLive && nextTrack && onNextTrack ? () => onNextTrack() : null);
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [track, nextTrack, onNextTrack, isLive, copy.liveBadge, nativeMode]);

  const togglePlay = () => {
    if (nativeMode) {
      if (playing) {
        void pauseNativeAudio().catch(() => {});
      } else {
        if (isLive) setBuffering(true);
        void resumeNativeAudio().catch(() => {
          setBuffering(false);
          setAudioError(true);
        });
      }
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      if (isLive) {
        setBuffering(true);
        if (!el.getAttribute('src')) {
          el.setAttribute('src', track.media.url);
          el.load();
        }
      }
      void el.play().catch(() => {
        setBuffering(false);
        setAudioError(true);
      });
    } else {
      el.pause();
    }
  };

  const retryLiveStream = () => {
    if (nativeMode) {
      setAudioError(false);
      setBuffering(true);
      void playNativeAudio({
        url: track.media.url,
        title: track.article.title,
        artist: `${track.article.sourceName} · ${copy.liveBadge}`,
        artworkUrl: track.article.imageUrl,
        isLive: true,
        speed: 1,
        stationId: track.radioStation?.id,
      }).catch(() => {
        setBuffering(false);
        setAudioError(true);
      });
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    setAudioError(false);
    setBuffering(true);
    el.setAttribute('src', track.media.url);
    el.load();
    void el.play().catch(() => {
      setBuffering(false);
      setAudioError(true);
    });
  };

  const seekBy = (delta: number) => {
    if (isLive) return;
    if (nativeMode) {
      void seekNativeAudioBy(delta).then((state) => setCurrentTime(state.currentTime)).catch(() => {});
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || duration || Infinity, el.currentTime + delta));
    setCurrentTime(el.currentTime);
  };

  const seekTo = (nextSeconds: number) => {
    if (isLive) return;
    if (nativeMode) {
      const clamped = Math.max(0, Math.min(duration || nextSeconds, nextSeconds));
      void seekNativeAudio(clamped).then((state) => setCurrentTime(state.currentTime)).catch(() => {});
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(el.duration || duration || nextSeconds, nextSeconds));
    try {
      el.currentTime = clamped;
      setCurrentTime(clamped);
    } catch {
      // Ignore seek errors on unbuffered streams
    }
  };

  const handleClose = () => {
    if (nativeMode) {
      void stopNativeAudio().catch(() => {});
    }
    onClose();
  };

  const sleepBadge =
    typeof sleepChoice === 'number'
      ? copy.sleepRemaining(sleepRemainingMin ?? sleepChoice)
      : sleepChoice === 'end-of-episode'
        ? copy.sleepEndOfEpisode
        : '';

  const externalHref = safeHref(track.article.linkIsFeed ? track.media.url : track.article.link) ?? safeHref(track.media.url);

  return (
    <aside
      aria-label={t('mediaNowPlaying')}
      className="mini-audio-player"
    >
      {!nativeMode && (
        <audio
          ref={audioRef}
          src={track.media.url}
          preload={isLive ? 'none' : 'metadata'}
          playsInline
        />
      )}

      <div className="px-3.5 pt-3 pb-2.5 space-y-2">
        {/* Main Track Info + Transport Row */}
        <div className="flex items-center gap-3">
          {isLive && track.radioStation ? (
            <div
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-extrabold tracking-tight text-white shadow-sm"
              style={{ backgroundColor: track.radioStation.accentColor }}
              aria-hidden="true"
            >
              {track.radioStation.shortCode}
            </div>
          ) : (
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
          )}

          {isLive ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
                  <span className={`h-1.5 w-1.5 rounded-full bg-white ${playing ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                  {copy.liveBadge}
                </span>
                <p className="truncate text-[13.5px] font-bold leading-snug text-[var(--ink)]">
                  {track.article.title}
                </p>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--muted)]">
                {buffering ? copy.radioConnecting : playing ? copy.radioPlaying : copy.radioPaused}
                {track.radioStation?.region ? ` · ${track.radioStation.region}` : ''}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenArticle(track.article)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-[13.5px] font-bold leading-snug text-[var(--ink)]">
                {track.article.title}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--muted)]">
                {track.article.sourceName}
              </p>
            </button>
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            {!isLive && (
              <button
                type="button"
                onClick={() => seekBy(-15)}
                aria-label={t('mediaAudioBack15')}
                className="hidden sm:grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
              >
                <RotateCcw size={15} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? t('mediaClipsPause') : t('mediaClipsPlay')}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm transition active:scale-95"
            >
              {playing ? (
                <Pause size={16} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={16} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
              )}
            </button>
            {!isLive && (
              <button
                type="button"
                onClick={() => seekBy(30)}
                aria-label={t('mediaAudioForward30')}
                className="hidden sm:grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
              >
                <RotateCw size={15} aria-hidden="true" />
              </button>
            )}
            {!isLive && nextTrack && onNextTrack && (
              <button
                type="button"
                onClick={onNextTrack}
                title={`${copy.nextEpisode}: ${nextTrack.article.title}`}
                aria-label={`${copy.nextEpisode}: ${nextTrack.article.title}`}
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
              >
                <SkipForward size={15} aria-hidden="true" />
              </button>
            )}
            {!isLive && (
              <button
                type="button"
                onClick={() => setSpeedIndex(i => (i + 1) % SPEEDS.length)}
                aria-label={t('mediaAudioSpeed')}
                className="grid h-9 min-w-[2.25rem] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums text-[var(--ink)] transition hover:bg-[var(--control)]"
              >
                {speed}×
              </button>
            )}
            {isLive && externalHref && (
              <a
                href={externalHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={copy.openOriginal}
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
              >
                <Radio size={15} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={cycleSleepTimer}
              aria-label={copy.sleepTimer}
              title={sleepBadge ? `${copy.sleepTimer}: ${sleepBadge}` : copy.sleepTimer}
              className={`inline-flex h-9 items-center gap-1 rounded-full px-2 text-[11px] font-bold transition ${
                sleepChoice
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]'
              }`}
            >
              <Moon size={14} aria-hidden="true" />
              {sleepBadge && <span className="tabular-nums">{sleepBadge}</span>}
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('miniPlayerClose')}
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Interactive Scrubber or Graceful Error Fallback */}
        {audioError ? (
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
            <span className="truncate">{copy.audioLoadError}</span>
            <div className="flex shrink-0 items-center gap-2">
              {isLive && (
                <button
                  type="button"
                  onClick={retryLiveStream}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {copy.radioRetry}
                </button>
              )}
              {externalHref && (
                <a
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                >
                  {copy.openOriginal}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        ) : !isLive ? (
          <div className="flex items-center gap-2.5">
            <span className="w-10 shrink-0 text-right text-[11px] font-medium text-[var(--muted)] tabular-nums">
              {formatAudioClock(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration > 0 ? Math.floor(duration) : 100}
              step={1}
              value={duration > 0 ? Math.min(Math.floor(currentTime), Math.floor(duration)) : 0}
              disabled={duration <= 0}
              aria-label={copy.seekLabel}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="audio-scrubber min-w-0 flex-1"
              style={{ '--audio-progress': `${progress}%` } as React.CSSProperties}
            />
            <span className="w-10 shrink-0 text-[11px] font-medium text-[var(--muted)] tabular-nums">
              {duration > 0 ? formatAudioClock(duration) : '—'}
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
