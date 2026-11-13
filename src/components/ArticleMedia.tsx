import { useState } from 'react';
import type { MediaAttachment, NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';

function MediaPlayer({ attachment }: { attachment: MediaAttachment }) {
  const [failed, setFailed] = useState(false);
  const isAudio = attachment.type === 'audio';
  const label = isAudio ? 'Audio-Beitrag' : 'Video';

  return (
    <div className="liquid-glass overflow-hidden rounded-2xl p-4">
      <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {failed ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {isAudio ? 'Der Audio-Beitrag' : 'Das Video'} kann gerade nicht abgespielt werden.
        </p>
      ) : attachment.type === 'youtube' ? (
        <iframe
          src={attachment.url}
          title="YouTube-Video"
          className="aspect-video w-full rounded-xl bg-black"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          onError={() => setFailed(true)}
        />
      ) : isAudio ? (
        <audio aria-label={label} src={attachment.url} controls preload="none"
          className="w-full" onError={() => setFailed(true)} />
      ) : (
        <video aria-label={label} src={attachment.url} controls playsInline preload="none"
          className="aspect-video w-full rounded-xl bg-black object-contain" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function ArticleMedia({ article, heroImage }: { article: NewsArticle; heroImage?: string }) {
  const media = article.media ?? legacyMedia(article);
  const attachments = media.filter(attachment => attachment.type !== 'image' || attachment.url !== heroImage);
  if (!attachments.length) return null;

  return (
    <div className="mt-5 space-y-4">
      {attachments.map(attachment => attachment.type === 'image' ? (
        <ArticleImage
          key={attachment.url}
          src={attachment.url}
          alt=""
          sourceShortCode={article.sourceShortCode}
          sourceColor={article.sourceColor}
          className="aspect-video w-full overflow-hidden rounded-2xl"
        />
      ) : <MediaPlayer key={attachment.url} attachment={attachment} />)}
    </div>
  );
}

function legacyMedia(article: NewsArticle): MediaAttachment[] {
  const media: MediaAttachment[] = [];
  for (const [type, url] of [['video', article.videoUrl], ['audio', article.audioUrl]] as const) {
    if (url && /^https?:\/\//i.test(url)) media.push({ type, url });
  }
  if (article.youtubeId && /^[\w-]{11}$/.test(article.youtubeId)) {
    media.push({ type: 'youtube', url: `https://www.youtube-nocookie.com/embed/${article.youtubeId}` });
  }
  return media;
}
