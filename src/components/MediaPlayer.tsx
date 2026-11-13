import { useEffect, useRef, useState } from 'react';
import type { PlayableMedia } from '../lib/articleMedia';

export function MediaPlayer({ media, title, poster, background, autoPlay = false }: {
  media: PlayableMedia;
  title: string;
  poster?: string;
  background: boolean;
  autoPlay?: boolean;
}) {
  const element = useRef<HTMLMediaElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const player = element.current;
    if (!player) return;
    const pauseWhenHidden = () => {
      if (document.hidden && !background) player.pause();
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    pauseWhenHidden();
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [background]);

  const shared = {
    src: media.url,
    autoPlay,
    controls: true,
    preload: 'none' as const,
    'aria-label': title,
    onPlay: () => {
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(player => {
        if (player !== element.current) player.pause();
      });
    },
    onError: () => setFailed(true),
  };

  return (
    <div className={media.type === 'audio' ? 'w-full' : 'relative h-full w-full bg-black'}>
      {media.type === 'youtube' ? (
        <iframe title={title} src={media.url + (autoPlay ? '?autoplay=1' : '')}
          className="h-full w-full" loading={autoPlay ? undefined : 'lazy'}
          referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : media.type === 'audio' ? (
        <audio {...shared} ref={node => { element.current = node; }} className="block w-full" />
      ) : (
        <video {...shared} ref={node => { element.current = node; }} poster={poster} playsInline
          className="block h-full w-full object-contain" />
      )}
      {failed && (
        <p role="status" className={media.type === 'audio' ? 'mt-2 text-sm' : 'absolute inset-x-0 bottom-12 bg-black/80 p-3 text-sm text-white'}>
          Dieser Beitrag kann hier gerade nicht abgespielt werden.
        </p>
      )}
    </div>
  );
}
