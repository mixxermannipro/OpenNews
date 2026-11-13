import { useEffect, useRef, useState } from 'react';
import type { PlayableMedia } from '../lib/articleMedia';

export function MediaPlayer({ media, title, poster, background, autoPlay = false, onEngaged }: {
  media: PlayableMedia;
  title: string;
  poster?: string;
  background: boolean;
  autoPlay?: boolean;
  onEngaged?: (seconds: number) => void;
}) {
  const element = useRef<HTMLMediaElement | null>(null);
  const soundtrack = useRef<HTMLAudioElement>(null);
  const wasPlaying = useRef(false);
  const resumeFromAudio = useRef(false);
  const engagementRecorded = useRef(false);
  const initialEmbed = useRef(true);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);

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
    };
  }, [background]);

  const shared = {
    src: media.url,
    autoPlay,
    controls: true,
    preload: 'none' as const,
    'aria-label': title,
    onPlay: () => {
      wasPlaying.current = true;
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(player => {
        if (player !== element.current) player.pause();
      });
    },
    onPause: () => {
      if (!document.hidden) wasPlaying.current = false;
    },
    onTimeUpdate: () => {
      const player = element.current;
      if (!player || engagementRecorded.current || document.hidden) return;
      const threshold = Math.min(30, Math.max(3, player.duration * 0.5));
      let watched = 0;
      for (let i = 0; i < player.played.length; i++) watched += player.played.end(i) - player.played.start(i);
      if (watched >= threshold) {
        engagementRecorded.current = true;
        onEngaged?.(watched);
      }
    },
    onEnded: () => { wasPlaying.current = false; },
    onError: () => setFailed(true),
  };

  return (
    <div className={media.type === 'audio' ? 'w-full' : 'relative h-full w-full bg-black'}>
      {media.type === 'youtube' ? (
        !hidden && <iframe title={title} src={media.url + (autoPlay && initialEmbed.current ? '?autoplay=1' : '')}
          className="h-full w-full" loading={autoPlay ? undefined : 'lazy'}
          referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : media.type === 'audio' ? (
        <audio {...shared} ref={node => { element.current = node; }} className="block w-full" />
      ) : (
        <>
          <video {...shared} ref={node => { element.current = node; }} poster={poster} playsInline
            className="block h-full w-full object-contain" />
          {background && <audio ref={soundtrack} src={media.url} preload="none" hidden />}
        </>
      )}
      {failed && (
        <p role="status" className={media.type === 'audio' ? 'mt-2 text-sm' : 'absolute inset-x-0 bottom-12 bg-black/80 p-3 text-sm text-white'}>
          Dieser Beitrag kann hier gerade nicht abgespielt werden.
        </p>
      )}
    </div>
  );
}
