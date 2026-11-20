import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PlayableMedia } from '../lib/articleMedia';
import { formatMediaTime, isDoubleTap } from '../lib/clipsEngine';
import { useI18n } from '../lib/i18n';

const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2, 0.75] as const;

export function MediaPlayer({
  media,
  title,
  poster,
  background,
  autoPlay = false,
  clip = false,
  muted = false,
  autoAdvance = false,
  onToggleMute,
  onDoubleTapLike,
  onProgress,
  onClipEnded,
  onEngaged,
}: {
  media: PlayableMedia;
  title: string;
  poster?: string;
  background: boolean;
  autoPlay?: boolean;
  clip?: boolean;
  muted?: boolean;
  autoAdvance?: boolean;
  onToggleMute?: () => void;
  onDoubleTapLike?: (coords: { x: number; y: number }) => void;
  onProgress?: (ratio: number) => void;
  onClipEnded?: () => void;
  onEngaged?: (seconds: number) => void;
}) {
  const { t } = useI18n();
  const element = useRef<HTMLMediaElement | null>(null);
  const soundtrack = useRef<HTMLAudioElement>(null);
  const wasPlaying = useRef(false);
  const resumeFromAudio = useRef(false);
  const engagementRecorded = useRef(false);
  const initialEmbed = useRef(true);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<number | undefined>(undefined);

  const [paused, setPaused] = useState(!autoPlay);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [tapPulse, setTapPulse] = useState<'play' | 'pause' | null>(null);

  useEffect(() => {
    const player = element.current;
    const audio = soundtrack.current;
    const visibilityChanged = () => {
      if (document.hidden) initialEmbed.current = false;
      setHidden(document.hidden);
      if (!player) return;

      if (document.hidden) {
        if (!background) player.pause();
        if (!audio || !wasPlaying.current) return;
        // Android may pause the video element itself as the app becomes hidden.
        resumeFromAudio.current = true;
        audio.currentTime = player.currentTime;
        audio.volume = player.volume;
        audio.muted = player.muted;
        player.pause();
        void audio.play().catch(() => {});
      } else if (audio && resumeFromAudio.current) {
        resumeFromAudio.current = false;
        const resume = !audio.paused;
        player.currentTime = audio.currentTime;
        audio.pause();
        if (resume) void player.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged);
      audio?.pause();
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    };
  }, [background]);

  const togglePlayback = () => {
    const player = element.current;
    if (!player) return;
    if (player.paused) {
      void player.play().catch(() => {});
      setTapPulse('play');
    } else {
      player.pause();
      setTapPulse('pause');
    }
    window.setTimeout(() => setTapPulse(null), 550);
  };

  const skipBy = (delta: number) => {
    const player = element.current;
    if (!player) return;
    const next = Math.max(0, Math.min(player.duration || Infinity, player.currentTime + delta));
    player.currentTime = next;
    setCurrentTime(next);
  };

  const cycleRate = () => {
    const nextIdx = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIdx);
    if (element.current) element.current.playbackRate = PLAYBACK_RATES[nextIdx];
  };

  const shared = {
    src: media.url,
    autoPlay,
    preload: (autoPlay ? 'auto' : 'metadata') as 'auto' | 'metadata',
    'aria-label': title,
    onLoadedMetadata: () => {
      const player = element.current;
      if (player && Number.isFinite(player.duration)) {
        setDuration(player.duration);
        player.playbackRate = PLAYBACK_RATES[rateIndex];
      }
    },
    onPlay: () => {
      wasPlaying.current = true;
      setPaused(false);
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(player => {
        if (player !== element.current) player.pause();
      });
    },
    onPause: () => {
      setPaused(true);
      if (!document.hidden) wasPlaying.current = false;
    },
    onTimeUpdate: () => {
      const player = element.current;
      if (!player) return;
      setCurrentTime(player.currentTime);
      if (Number.isFinite(player.duration) && player.duration > 0) {
        if (duration !== player.duration) setDuration(player.duration);
        onProgress?.(Math.min(1, Math.max(0, player.currentTime / player.duration)));
      }
      if (engagementRecorded.current || document.hidden) return;
      const threshold = Math.min(30, Math.max(3, (player.duration || 10) * 0.5));
      let watched = 0;
      for (let i = 0; i < player.played.length; i++) watched += player.played.end(i) - player.played.start(i);
      if (watched >= threshold) {
        engagementRecorded.current = true;
        onEngaged?.(watched);
      }
    },
    onEnded: () => {
      wasPlaying.current = false;
      onProgress?.(1);
      if (clip && autoAdvance) onClipEnded?.();
    },
    onError: () => setFailed(true),
  };

  const embedParams = new URLSearchParams();
  embedParams.set('rel', '0');
  embedParams.set('modestbranding', '1');
  if (autoPlay && initialEmbed.current) {
    embedParams.set('autoplay', '1');
    if (clip) {
      embedParams.set('playsinline', '1');
      if (muted) embedParams.set('mute', '1');
    }
  }
  const embedSource = `${media.url}${media.url.includes('?') ? '&' : '?'}${embedParams.toString()}`;

  const handleClipSurfaceClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const coords = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    if (onDoubleTapLike && isDoubleTap(lastTapRef.current, now)) {
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
      lastTapRef.current = 0;
      onDoubleTapLike(coords);
      return;
    }

    lastTapRef.current = now;
    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      togglePlayback();
    }, onDoubleTapLike ? 220 : 0);
  };

  const progressRatio = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={media.type === 'audio' ? 'w-full' : 'relative h-full w-full bg-black'}>
      {media.type === 'youtube' ? (
        !hidden && (
          <iframe
            title={title}
            src={embedSource}
            className="h-full w-full border-0"
            loading={autoPlay ? undefined : 'lazy'}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )
      ) : media.type === 'audio' ? (
        <div className="audio-deck space-y-2.5">
          <audio {...shared} ref={node => { element.current = node; }} className="hidden" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => skipBy(-15)}
              aria-label={t('mediaAudioBack15')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--control)] text-[var(--ink)] transition-transform active:scale-95"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={paused ? t('mediaClipsPlay') : t('mediaClipsPause')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm transition-transform active:scale-95"
            >
              {paused ? <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" aria-hidden="true" /> : <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => skipBy(30)}
              aria-label={t('mediaAudioForward30')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--control)] text-[var(--ink)] transition-transform active:scale-95"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 px-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={1}
                value={currentTime}
                aria-label={title}
                onChange={event => {
                  const val = Number(event.target.value);
                  if (element.current) element.current.currentTime = val;
                  setCurrentTime(val);
                }}
                className="audio-scrubber w-full"
                style={{ '--audio-progress': `${progressRatio}%` } as React.CSSProperties}
              />
              <div className="mt-1 flex items-center justify-between text-[11px] font-medium tabular-nums text-[var(--muted)]">
                <span>{formatMediaTime(currentTime)}</span>
                <span>{duration > 0 ? formatMediaTime(duration) : '--:--'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={cycleRate}
              aria-label={t('mediaAudioSpeed')}
              className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--control)] px-2.5 text-xs font-bold tabular-nums text-[var(--ink)] transition-transform active:scale-95"
            >
              {PLAYBACK_RATES[rateIndex]}×
            </button>
          </div>
        </div>
      ) : (
        <>
          <video
            {...shared}
            ref={node => { element.current = node; }}
            poster={poster}
            playsInline
            controls={!clip}
            muted={muted}
            loop={clip && !autoAdvance}
            className={clip ? 'block h-full w-full object-cover' : 'block h-full w-full object-contain'}
          />
          {clip && !failed && (
            <>
              <button
                type="button"
                aria-label={paused ? t('mediaClipsPlay') : t('mediaClipsPause')}
                className="absolute inset-0 grid place-items-center touch-pan-y text-white"
                onClick={handleClipSurfaceClick}
              >
                {(paused || tapPulse) && (
                  <span
                    className={`grid size-16 place-items-center rounded-full bg-black/55 backdrop-blur-md transition-all duration-200 ${
                      paused ? 'scale-100 opacity-100' : 'scale-110 opacity-85'
                    }`}
                  >
                    {paused ? <Play size={28} fill="currentColor" className="translate-x-0.5" /> : <Pause size={26} fill="currentColor" />}
                  </span>
                )}
              </button>
              {onToggleMute && (
                <button
                  type="button"
                  aria-label={muted ? t('mediaClipsUnmute') : t('mediaClipsMute')}
                  className="sr-only"
                  onClick={onToggleMute}
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </button>
              )}
            </>
          )}
          {background && <audio ref={soundtrack} src={media.url} preload="none" hidden />}
        </>
      )}
      {failed && (
        <p role="status" className={media.type === 'audio' ? 'mt-2 text-sm text-[var(--muted)]' : 'absolute inset-x-0 bottom-16 bg-black/80 p-3 text-center text-sm text-white'}>
          {t('mediaEmpty')}
        </p>
      )}
    </div>
  );
}
