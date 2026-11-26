import { contentUrlKey, extractYouTubeId } from './contentIdentity';
import { articleIdentity } from './newsFeed';
import type { MediaAttachment, NewsArticle } from '../types/news';

export type PlayableMedia = MediaAttachment & { type: 'audio' | 'video' | 'youtube' };

const TRACKING_HOST_PATTERN =
  /(?:^|\.)(?:vgwort\.de|feedburner\.com|doubleclick\.net|googlesyndication\.com|google-analytics\.com|scorecardresearch\.com|quantserve\.com|adnxs\.com|adsrvr\.org|criteo\.com|taboola\.com|outbrain\.com|chartbeat\.net|omtrdc\.net|2o7\.net|demdex\.net|mc\.yandex\.ru|pixel\.wp\.com|stats\.wp\.com|fls-na\.amazon\.com|ioam\.de|ivwbox\.de)$/i;

const TRACKING_PATH_PATTERN =
  /(?:\/tracking\/|\/track\/|\/beacon\/|\/pixel\/|npr-rss-pixel|\/~(?:r|ff)\/|\/1x1(?:\.|\/|$)|(?:^|[/_-])(?:pixel|spacer|blank|clear|transparent|beacon|tracker|counter|imp|open)\.(?:gif|png|jpe?g|webp)$)/i;

export function isTrackingPixelUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (TRACKING_HOST_PATTERN.test(host)) return true;
    if (/^(?:analytics|metrics|beacon|pixel|track|tracker|stats|count|counter|adserver)\./i.test(host)) {
      return true;
    }
    if (TRACKING_PATH_PATTERN.test(url.pathname)) return true;
    const w = Number(url.searchParams.get('w') || url.searchParams.get('width'));
    const h = Number(url.searchParams.get('h') || url.searchParams.get('height'));
    if ((w > 0 && w <= 4) || (h > 0 && h <= 4)) return true;
  } catch {
    return false;
  }
  return false;
}

export function readerImageKey(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // BILD's feed places alternate crops of its lead photo under the same article ID.
    const bildFeedImage = /^\/(\p{ASCII_Hex_Digit}{24})\/[\p{ASCII_Hex_Digit}]{32}(?:-[a-z]+)?,[\p{ASCII_Hex_Digit}]+$/u;
    const bildArticleId = host === 'images.bild.de' ? bildFeedImage.exec(url.pathname)?.[1] : undefined;
    if (bildArticleId) return url.origin + '/' + bildArticleId;

    // ZEIT ONLINE serves multiple crop/size variants under /.../<slug>/<variant>__<W>x<H>
    if (host === 'img.zeit.de') {
      const stripped = url.pathname.replace(/\/[a-z0-9-]+__\d+x\d+[^/]*\/?$/i, '');
      if (stripped !== url.pathname && stripped.length > 1) {
        return `${host}${stripped}`;
      }
    }

    // BBC ichef serves multiple width variants: /ace/standard/240/... vs /ace/standard/1024/...
    if (host === 'ichef.bbci.co.uk') {
      const normalized = url.pathname
        .replace(/^\/(?:ace\/(?:standard|branded_news)|news)\/\d+\//i, '/bbci/')
        .replace(/\.webp$/i, '');
      return `${host}${normalized}`;
    }

    // Tagesschau serves different aspect ratios under /image/<uuid>/<hash>/<format>/...
    if (host === 'images.tagesschau.de') {
      const tsMatch = /^\/image\/([^/]+)\//i.exec(url.pathname);
      if (tsMatch?.[1]) return `${host}/image/${tsMatch[1]}`;
    }

    // SPIEGEL CDN encodes crop/width suffixes in filenames: ..._w1200_r1.778_fpx50_fpy50.jpg
    if (host === 'cdn.prod.www.spiegel.de') {
      const normalized = url.pathname.replace(/_w\d+_r[\d.]+(?:_fpx[\d.]+_fpy[\d.]+)?(?=\.[a-z]+$)/i, '');
      return `${host}${normalized}`;
    }

    // FAZ serves across numbered CDN hosts (media0.faz.net, media1.faz.net) with width segments
    if (/^media\d*\.faz\.net$/i.test(host)) {
      const normalized = url.pathname.replace(/\/w\d+\//i, '/');
      return `media.faz.net${normalized}`;
    }

    // The Guardian signs each crop/width with a distinct `s=` query param
    if (host === 'i.guim.co.uk') {
      return `${host}${url.pathname}`;
    }
  } catch {
    // Bundled image paths can be relative.
  }
  return contentUrlKey(value, 'image') || value;
}

function estimateImageResolution(value: string): number {
  const dimMatch = value.match(/(?:__|\/|_|-)(\d{2,4})x(\d{2,4})(?:[^\d]|$)/i);
  if (dimMatch) return Number(dimMatch[1]) * Number(dimMatch[2]);
  try {
    const url = new URL(value);
    const w = Number(url.searchParams.get('w') || url.searchParams.get('width') || url.searchParams.get('imwidth'));
    if (Number.isFinite(w) && w > 0) return w * w;
    const pathWidth = url.pathname.match(/\/(?:(?:standard|branded_news|news)\/|w)(\d{2,4})\//i);
    if (pathWidth) return Number(pathWidth[1]) * Number(pathWidth[1]);
  } catch {
    // Ignore relative URLs
  }
  return 0;
}

export function getReaderAttachments(
  media: MediaAttachment[],
  heroImage?: string,
  extraHeroImages: Array<string | undefined> = [],
): MediaAttachment[] {
  const heroKeys = new Set(
    [heroImage, ...extraHeroImages].filter((img): img is string => Boolean(img)).map(readerImageKey),
  );
  return deduplicateAttachments(media).filter(
    attachment => attachment.type !== 'image'
      || (!isTrackingPixelUrl(attachment.url) && !heroKeys.has(readerImageKey(attachment.url))),
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
    if (attachment.type === 'image' && isTrackingPixelUrl(attachment.url)) continue;
    const key = attachmentKey(attachment);
    const existing = entries.get(key);
    const preferFile = existing && key.startsWith('welt-video:')
      && /\.m3u8(?:[?#]|$)/i.test(existing.url) && /\.mp4(?:[?#]|$)/i.test(attachment.url);
    const preferHigherResImage = existing && attachment.type === 'image'
      && estimateImageResolution(attachment.url) > estimateImageResolution(existing.url);
    if (
      !existing
      || preferFile
      || preferHigherResImage
      || (key.startsWith('youtube:') && attachment.portrait && !existing.portrait)
    ) {
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
