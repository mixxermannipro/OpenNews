import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppLanguage, NewsArticle, NewsSource } from '../types/news';
import { getArticleMedia } from './articleMedia';
import { NEWS_UPDATE_AUDIO_SOURCE_IDS } from './radioCatalog';
import type { AudioPositionEntry } from './readerExtras';

export type AndroidAutoMode = 'all_audio' | 'subscribed_only';

export interface AndroidAutoSettings {
  mode: AndroidAutoMode;
  autoplayQueue: boolean;
  showLiveRadio: boolean;
  directFeedRefresh: boolean;
}

export const DEFAULT_ANDROID_AUTO_SETTINGS: AndroidAutoSettings = {
  mode: 'all_audio',
  autoplayQueue: true,
  showLiveRadio: true,
  directFeedRefresh: true,
};

export interface AndroidAutoFeedPayload {
  id: string;
  name: string;
  url: string;
  language: AppLanguage;
  subscribed: boolean;
  newsUpdate: boolean;
}

export interface AndroidAutoEpisodePayload {
  mediaId: string;
  feedId: string;
  feedName: string;
  title: string;
  summary: string;
  audioUrl: string;
  artworkUrl: string;
  publishedMs: number;
  durationSec: number;
  newsUpdate: boolean;
}

export interface AndroidAutoSyncPayload {
  settings: AndroidAutoSettings;
  language: AppLanguage;
  feeds: AndroidAutoFeedPayload[];
  radioFavorites: string[];
  queue: AndroidAutoEpisodePayload[];
  positions: Record<string, AudioPositionEntry>;
}

export interface AndroidAutoStatus {
  mode: AndroidAutoMode;
  activeFeeds: number;
  cachedEpisodes: number;
  radioStations: number;
  queueCount: number;
  lastRefreshAt: number;
  refreshedEpisodes?: number;
}

const UPDATE_SOURCE_SET = new Set<string>(NEWS_UPDATE_AUDIO_SOURCE_IDS);

function isAudioPodcastFeed(source: NewsSource): boolean {
  if (source.format !== 'podcast') return false;
  if (!source.url.startsWith('https://')) return false;
  if (source.url.includes('youtube.com/feeds/videos.xml')) return false;
  const tags = source.tags ?? [];
  if (tags.includes('audio') || tags.includes('podcast')) return true;
  if (tags.includes('video') || tags.includes('youtube') || tags.includes('clips')) return false;
  return !/video/i.test(`${source.name} ${source.url}`);
}

export function buildAndroidAutoPayload(params: {
  settings: AndroidAutoSettings;
  language: AppLanguage;
  sources: readonly NewsSource[];
  articles: readonly NewsArticle[];
  radioFavorites: readonly string[];
  audioPositions: Record<string, AudioPositionEntry>;
}): AndroidAutoSyncPayload {
  const { settings, language, sources, articles, radioFavorites, audioPositions } = params;

  const feeds: AndroidAutoFeedPayload[] = sources
    .filter(isAudioPodcastFeed)
    .map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      language: source.language,
      subscribed: source.subscribed,
      newsUpdate:
        UPDATE_SOURCE_SET.has(source.id) ||
        /tagesschau|tagesthemen|heute journal|nachrichten|echo der zeit|up first|global news/i.test(source.name),
    }));

  const queue: AndroidAutoEpisodePayload[] = [];
  const seenUrls = new Set<string>();
  const sortedArticles = [...articles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  for (const article of sortedArticles) {
    const audio = getArticleMedia(article).find((m) => m.type === 'audio' && m.url.startsWith('https://'));
    if (!audio || seenUrls.has(audio.url)) continue;
    const savedPos = audioPositions[audio.url];
    const hasProgress = Boolean(savedPos && savedPos.seconds >= 10);
    const isUpdate = UPDATE_SOURCE_SET.has(article.sourceId);
    if (!hasProgress && !isUpdate && queue.length >= 25) continue;

    seenUrls.add(audio.url);
    queue.push({
      mediaId: `app:${article.id}`,
      feedId: article.sourceId || article.sourceName,
      feedName: article.sourceName,
      title: article.title,
      summary: article.summary || '',
      audioUrl: audio.url,
      artworkUrl: article.imageUrl?.startsWith('https://') ? article.imageUrl : '',
      publishedMs: Number.isFinite(Date.parse(article.publishedAt)) ? Date.parse(article.publishedAt) : 0,
      durationSec: Math.round(audio.durationSec ?? article.durationSec ?? 0),
      newsUpdate: isUpdate,
    });
    if (queue.length >= 40) break;
  }

  return {
    settings,
    language,
    feeds,
    radioFavorites: [...radioFavorites],
    queue,
    positions: audioPositions,
  };
}

const AndroidAutoSyncPlugin = registerPlugin<{
  sync(options: AndroidAutoSyncPayload): Promise<AndroidAutoStatus>;
  refreshNow(): Promise<AndroidAutoStatus>;
  getStatus(): Promise<AndroidAutoStatus>;
}>('AndroidAutoSync');

export async function syncAndroidAuto(payload: AndroidAutoSyncPayload): Promise<AndroidAutoStatus | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return await AndroidAutoSyncPlugin.sync(payload);
  } catch {
    return null;
  }
}

export async function refreshAndroidAutoNow(): Promise<AndroidAutoStatus | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return await AndroidAutoSyncPlugin.refreshNow();
  } catch {
    return null;
  }
}

export async function getAndroidAutoStatus(): Promise<AndroidAutoStatus | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return await AndroidAutoSyncPlugin.getStatus();
  } catch {
    return null;
  }
}
