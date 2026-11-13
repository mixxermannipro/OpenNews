import type { MediaAttachment, NewsArticle } from '../types/news';

export type PlayableMedia = MediaAttachment & { type: 'audio' | 'video' | 'youtube' };

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
