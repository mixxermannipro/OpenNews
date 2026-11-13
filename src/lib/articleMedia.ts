import { contentUrlKey, extractYouTubeId } from './contentIdentity';
import { articleIdentity } from './newsFeed';
import type { MediaAttachment, NewsArticle } from '../types/news';

export type PlayableMedia = MediaAttachment & { type: 'audio' | 'video' | 'youtube' };

function readerImageKey(value: string): string {
  try {
    const url = new URL(value);
    // BILD's feed places alternate crops of its lead photo under the same article ID.
    const bildFeedImage = /^\/(\p{ASCII_Hex_Digit}{24})\/[\p{ASCII_Hex_Digit}]{32}(?:-[a-z]+)?,[\p{ASCII_Hex_Digit}]+$/u;
    const articleId = url.hostname === 'images.bild.de' ? bildFeedImage.exec(url.pathname)?.[1] : undefined;
    if (articleId) return url.origin + '/' + articleId;
  } catch {
    // Bundled image paths can be relative.
  }
  return contentUrlKey(value, 'image') || value;
}

export function getReaderAttachments(media: MediaAttachment[], heroImage?: string): MediaAttachment[] {
  const heroKey = heroImage && readerImageKey(heroImage);
  return deduplicateAttachments(media).filter(
    attachment => attachment.type !== 'image' || readerImageKey(attachment.url) !== heroKey,
  );
}

export function attachmentKey({ type, url }: MediaAttachment): string {
  if (type === 'image') return `image:${readerImageKey(url)}`;
  const youtubeId = type === 'youtube' || type === 'video' ? extractYouTubeId(url) : undefined;
  if (youtubeId) return `youtube:${youtubeId}`;
  const clipId = type === 'video'
    ? /^https:\/\/welt\.cdn\.content-discovery\.video\/videos\/([\w-]+)\/rendition\//i.exec(url)?.[1]
    : undefined;
  if (clipId) return `welt-video:${clipId}`;
  const ardClip = type === 'video'
    ? /^https:\/\/tagesschau-progressive\.ard-mcdn\.de(\/video\/\d{4}\/\d{4}\/[^./?#]+)\.web(?:s|m|l|xl)\.h264\.mp4(?:[?#]|$)/i.exec(url)?.[1]
    : undefined;
  return ardClip ? `ard-video:${ardClip}` : `${type}:${contentUrlKey(url, 'media') || url}`;
}

export function deduplicateAttachments<T extends MediaAttachment>(media: T[]): T[] {
  const entries = new Map<string, T>();
  for (const attachment of media) {
    const key = attachmentKey(attachment);
    const existing = entries.get(key);
    const preferFile = existing && key.startsWith('welt-video:')
      && /\.m3u8(?:[?#]|$)/i.test(existing.url) && /\.mp4(?:[?#]|$)/i.test(attachment.url);
    if (!existing || preferFile || (key.startsWith('youtube:') && attachment.portrait && !existing.portrait)) {
      entries.set(key, attachment);
    }
  }
  return [...entries.values()];
}

export function getArticleMedia(article: Pick<NewsArticle, 'media' | 'videoUrl' | 'audioUrl' | 'youtubeId'>): PlayableMedia[] {
  if (article.media) return deduplicateAttachments(article.media.filter((item): item is PlayableMedia => item.type !== 'image'));
  const attachments = [
    { type: 'video', url: article.videoUrl },
    { type: 'audio', url: article.audioUrl },
  ];
  const media: PlayableMedia[] = [];
  for (const { type, url } of attachments) {
    if ((type === 'audio' || type === 'video') && url && /^https?:\/\//i.test(url)) {
      media.push({ type, url });
    }
  }
  if (article.youtubeId && /^[\w-]{11}$/.test(article.youtubeId)) {
    media.unshift({ type: 'youtube', url: `https://www.youtube-nocookie.com/embed/${article.youtubeId}` });
  }
  return media;
}

export function collectDistinctMedia(articles: NewsArticle[]): { article: NewsArticle; media: PlayableMedia }[] {
  const entries = new Map<string, { article: NewsArticle; media: PlayableMedia }>();
  const knownClips = new Set<string>();
  for (const article of articles) {
    for (const media of getArticleMedia(article)) {
      const key = attachmentKey(media);
      const existing = entries.get(key);
      if (existing) {
        if (media.portrait && !existing.media.portrait) entries.set(key, { article, media });
        continue;
      }

      const title = article.title.normalize('NFKC').toLocaleLowerCase('de-DE')
        .replace(/#[\p{L}\p{N}_]+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const sameClip = media.portrait && title.length >= 24 ? title : '';
      const identity = sameClip || (media.portrait && !article.linkIsFeed ? articleIdentity(article) : '');
      if (identity && knownClips.has(identity)) continue;
      if (identity) knownClips.add(identity);
      entries.set(key, { article, media });
    }
  }
  return [...entries.values()];
}
