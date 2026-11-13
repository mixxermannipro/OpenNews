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
  return value;
}

export function getReaderAttachments(media: MediaAttachment[], heroImage?: string): MediaAttachment[] {
  const seenImages = new Set(heroImage ? [readerImageKey(heroImage)] : []);
  return media.filter(attachment => {
    if (attachment.type !== 'image') return true;
    const key = readerImageKey(attachment.url);
    if (seenImages.has(key)) return false;
    seenImages.add(key);
    return true;
  });
}

export function getArticleMedia(article: NewsArticle): PlayableMedia[] {
  if (article.media) return article.media.filter((item): item is PlayableMedia => item.type !== 'image');
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
