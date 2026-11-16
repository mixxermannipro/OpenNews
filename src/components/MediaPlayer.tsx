import { Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { extractYouTubeId } from '../lib/contentIdentity';
import { PLAY_BETA } from '../lib/playBeta';
import type { PlayableMedia } from '../lib/articleMedia';

export function MediaPlayer({ media, title, poster, background, autoPlay = false, clip = false, muted = false, onToggleMute, onEngaged }: {
  media: PlayableMedia;
  title: string;
  poster?: string;
  background: boolean;
  autoPlay?: boolean;
  clip?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  onEngaged?: (seconds: number) => void;
}) {
  const element = useRef<HTMLMediaElement | null>(null);
  const soundtrack = useRef<HTMLAudioElement>(null);
  const wasPlaying = useRef(false);
  const resumeFromAudio = useRef(false);
  const engagementRecorded = useRef(false);
  const initialEmbed = useRef(true);
  const [paused, setPaused] = useState(true);
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

  const embedParams = new URLSearchParams();
  if (autoPlay && initialEmbed.current) {
    embedParams.set('autoplay', '1');
    if (clip) {
      embedParams.set('playsinline', '1');
      if (muted) embedParams.set('mute', '1');
    }
  }
  const embedSource = embedParams.size ? media.url + '?' + embedParams : media.url;

  if (PLAY_BETA) {
    const youtubeId = media.type === 'youtube' ? extractYouTubeId(media.url) : undefined;
    const providerUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : media.url;
    return <a href={providerUrl} target="_blank" rel="noopener noreferrer" className="grid h-full min-h-11 place-items-center px-4 text-center text-white underline">
      Beim Anbieter öffnen
    </a>;
  }
  return (
    <div className={media.type === 'audio' ? 'w-full' : 'relative h-full w-full bg-black'}>
      {media.type === 'youtube' ? (
        !hidden && <iframe title={title} src={embedSource}
          className="h-full w-full" loading={autoPlay ? undefined : 'lazy'}
          referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : media.type === 'audio' ? (
        <audio {...shared} ref={node => { element.current = node; }} className="block w-full" />
      ) : (
        <>
          <video {...shared} ref={node => { element.current = node; }} poster={poster} playsInline controls={!clip} muted={muted} loop={clip}
            className={clip ? "block h-full w-full object-cover sm:object-contain" : "block h-full w-full object-contain"} />
          {clip && !failed && (
            <>
              <button type="button" aria-label={paused ? 'Clip abspielen' : 'Clip pausieren'}
                className="absolute inset-0 grid place-items-center touch-pan-y text-white" onClick={() => {
                  const player = element.current;
                  if (player?.paused) void player.play().catch(() => {});
                  else player?.pause();
                }}>
                {paused && <span className="grid size-16 place-items-center rounded-full bg-black/70"><Play size={28} fill="currentColor" /></span>}
              </button>
              <button type="button" aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
                className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] grid size-12 place-items-center rounded-full bg-black/70"
                onClick={onToggleMute}>{muted ? <VolumeX /> : <Volume2 />}</button>
            </>
          )}
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
