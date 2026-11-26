import type { AppLanguage, NewsArticle, NewsSource } from '../types/news';
import type { PlayableMedia } from './articleMedia';
import type { StarterPack } from './catalog';
import type { AudioPositionEntry } from './readerExtras';

export interface MediaEntry {
  article: NewsArticle;
  media: PlayableMedia;
}

export type ClipsFeedMode = 'shorts' | 'all-video';

/**
 * Interleaves media entries across distinct sources (round-robin) so a vertical
 * social-style feed feels fresh and varied rather than stacking 10 clips from
 * the same channel consecutively.
 */
export function interleaveClipsBySource(entries: readonly MediaEntry[]): MediaEntry[] {
  if (entries.length <= 2) return [...entries];

  const buckets = new Map<string, MediaEntry[]>();
  const order: string[] = [];

  for (const entry of entries) {
    const key = entry.article.sourceId || entry.article.sourceName;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
      order.push(key);
    }
    list.push(entry);
  }

  const result: MediaEntry[] = [];
  let remaining = entries.length;
  while (remaining > 0) {
    for (const key of order) {
      const list = buckets.get(key);
      if (list && list.length > 0) {
        result.push(list.shift()!);
        remaining -= 1;
      }
    }
  }
  return result;
}

/**
 * Builds the vertical Clips playlist.
 * - `shorts` mode prioritizes vertical/portrait Shorts clips.
 * - `all-video` mode mixes Shorts first followed by widescreen video entries.
 * - If `shorts` has zero items and `fallbackToVideos` is true, falls back smoothly
 *   to video entries so users with non-Shorts video channels still get a rich feed.
 */
export function buildClipsPlaylist(
  entries: readonly MediaEntry[],
  mode: ClipsFeedMode = 'shorts',
  fallbackToVideos = true,
): { items: MediaEntry[]; hasDedicatedShorts: boolean; usingFallback: boolean } {
  const shorts = entries.filter(({ media }) => media.portrait && media.type !== 'audio');
  const videos = entries.filter(({ media }) => !media.portrait && media.type !== 'audio');

  if (mode === 'all-video') {
    return {
      items: interleaveClipsBySource([...shorts, ...videos]),
      hasDedicatedShorts: shorts.length > 0,
      usingFallback: shorts.length === 0 && videos.length > 0,
    };
  }

  if (shorts.length > 0) {
    return {
      items: interleaveClipsBySource(shorts),
      hasDedicatedShorts: true,
      usingFallback: false,
    };
  }

  if (fallbackToVideos && videos.length > 0) {
    return {
      items: interleaveClipsBySource(videos),
      hasDedicatedShorts: false,
      usingFallback: true,
    };
  }

  return {
    items: [],
    hasDedicatedShorts: false,
    usingFallback: false,
  };
}

/**
 * Virtualization helper for the full-screen Clips feed:
 * - Only the active clip mounts the live video/iframe player (`active`).
 * - Adjacent slides within +-1 preload their poster & metadata (`nearby`).
 * - Slides further away stay lightweight shells (`idle`).
 */
export function getClipRenderState(index: number, activeIndex: number): 'active' | 'nearby' | 'idle' {
  const distance = Math.abs(index - activeIndex);
  if (distance === 0) return 'active';
  if (distance <= 1) return 'nearby';
  return 'idle';
}

/**
 * Pure double-tap detector for Instagram Reels / TikTok double-tap-to-like.
 */
export function isDoubleTap(lastTapMs: number, nowMs: number, thresholdMs = 280): boolean {
  if (!Number.isFinite(lastTapMs) || !Number.isFinite(nowMs) || lastTapMs <= 0) return false;
  const delta = nowMs - lastTapMs;
  return delta >= 0 && delta <= thresholdMs;
}

/**
 * Clamps next/prev clip navigation cleanly inside [0, total - 1].
 */
export function resolveClipStep(currentIndex: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, currentIndex + delta));
}

/**
 * Formats seconds into crisp tabular media time (`0:45`, `12:08`, `1:04:08`).
 */
export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const secStr = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${secStr}`;
  }
  return `${mins}:${secStr}`;
}

/**
 * Extracts distinct media channels ordered by count for the Instagram-style
 * channel stories strip at the top of the Media view.
 */
export type MediaTabFilter = 'all' | 'video' | 'audio' | 'clips';

export interface MediaChannelSummary {
  sourceId: string;
  sourceName: string;
  sourceShortCode: string;
  sourceColor: string;
  count: number;
  hasClips: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
}

export function extractMediaChannels(
  entries: readonly MediaEntry[],
  filter: MediaTabFilter = 'all',
): MediaChannelSummary[] {
  const scoped = entries.filter(({ media }) => {
    if (filter === 'audio') return media.type === 'audio';
    if (filter === 'video') return media.type !== 'audio';
    if (filter === 'clips') return media.type !== 'audio';
    return true;
  });

  const map = new Map<string, MediaChannelSummary>();
  for (const { article, media } of scoped) {
    const id = article.sourceId || article.sourceName;
    const existing = map.get(id);
    if (existing) {
      existing.count += 1;
      if (media.portrait) existing.hasClips = true;
      if (media.type === 'audio') existing.hasAudio = true;
      if (media.type !== 'audio' && !media.portrait) existing.hasVideo = true;
    } else {
      map.set(id, {
        sourceId: id,
        sourceName: article.sourceName,
        sourceShortCode: article.sourceShortCode,
        sourceColor: article.sourceColor,
        count: 1,
        hasClips: Boolean(media.portrait),
        hasAudio: media.type === 'audio',
        hasVideo: media.type !== 'audio' && !media.portrait,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => Number(b.hasClips) - Number(a.hasClips) || b.count - a.count,
  );
}

export interface ContinueListeningItem {
  entry: MediaEntry;
  seconds: number;
  duration: number;
  progressPct: number;
  remainingSec: number;
  updatedAt: number;
}

/**
 * Finds unfinished audio episodes that have saved playback progress, ordered by
 * most recently listened.
 */
export function extractContinueListening(
  entries: readonly MediaEntry[],
  audioPositions: Record<string, AudioPositionEntry> = {},
  limit = 6,
): ContinueListeningItem[] {
  const results: ContinueListeningItem[] = [];
  for (const entry of entries) {
    if (entry.media.type !== 'audio') continue;
    const pos = audioPositions[entry.media.url];
    if (!pos || !Number.isFinite(pos.seconds) || pos.seconds < 10) continue;
    const duration =
      (Number.isFinite(pos.duration) && pos.duration > 0 ? pos.duration : 0) ||
      entry.media.durationSec ||
      entry.article.durationSec ||
      0;
    if (duration > 0 && pos.seconds >= duration - 12) continue;
    const progressPct = duration > 0 ? Math.min(99, Math.max(2, Math.round((pos.seconds / duration) * 100))) : 15;
    const remainingSec = duration > 0 ? Math.max(0, Math.round(duration - pos.seconds)) : 0;
    results.push({
      entry,
      seconds: Math.floor(pos.seconds),
      duration: Math.floor(duration),
      progressPct,
      remainingSec,
      updatedAt: pos.updatedAt || 0,
    });
  }
  return results.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

function normalizeSearchFold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Multi-token umlaut-aware search over video & audio media entries.
 */
export function filterMediaEntries(entries: readonly MediaEntry[], query: string): MediaEntry[] {
  const normalized = normalizeSearchFold(query);
  if (!normalized) return [...entries];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [...entries];

  return entries.filter(({ article }) => {
    const haystack = normalizeSearchFold(
      `${article.title} ${article.sourceName} ${article.category} ${article.summary} ${article.keywords.join(' ')}`,
    );
    return tokens.every(token => haystack.includes(token));
  });
}

/**
 * Formats an optional duration in seconds into a crisp tabular label (`14:22`, `1:05:10`),
 * or returns undefined if duration is absent or invalid.
 */
export function formatDurationLabel(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return formatMediaTime(seconds);
}

function isAudioPodcastSource(source: NewsSource): boolean {
  if (source.format !== 'podcast') return false;
  if (source.url.includes('youtube.com/feeds/videos.xml')) return false;
  const tags = source.tags ?? [];
  if (tags.includes('audio') || tags.includes('podcast')) return true;
  if (tags.includes('video') || tags.includes('youtube') || tags.includes('clips')) return false;
  return /audio|podcast/i.test(`${source.name} ${source.url}`);
}

function isVideoMediaSource(source: NewsSource): boolean {
  if (source.format !== 'podcast') return false;
  return !isAudioPodcastSource(source);
}

/**
 * Selects unsubscribed curated media channels tailored to the active format tab and user language.
 */
export function selectMediaDiscoverySources(
  sources: readonly NewsSource[],
  lang: AppLanguage,
  filter: MediaTabFilter = 'all',
  limit = 6,
): NewsSource[] {
  const candidates = sources.filter(source => {
    if (source.format !== 'podcast' || source.subscribed) return false;
    if (filter === 'audio') return isAudioPodcastSource(source);
    if (filter === 'video' || filter === 'clips') return isVideoMediaSource(source);
    return true;
  });

  const score = (source: NewsSource): number => {
    let s = 0;
    if (source.language === lang) s += 40;
    else if (source.language === 'en') s += 15;
    if (source.recommended) s += 12;
    if (filter === 'all' && isAudioPodcastSource(source)) s += 4;
    return s;
  };

  const sorted = [...candidates].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));

  if (filter === 'all') {
    const audio = sorted.filter(isAudioPodcastSource);
    const video = sorted.filter(isVideoMediaSource);
    const interleaved: NewsSource[] = [];
    const maxLen = Math.max(audio.length, video.length);
    for (let i = 0; i < maxLen && interleaved.length < limit; i += 1) {
      if (video[i] && interleaved.length < limit) interleaved.push(video[i]);
      if (audio[i] && interleaved.length < limit) interleaved.push(audio[i]);
    }
    return interleaved;
  }

  return sorted.slice(0, limit);
}

const AUDIO_PACK_IDS = new Set(['podcasts-dach', 'podcasts-daily']);
const VIDEO_PACK_IDS = new Set(['clips-dach', 'clips-social', 'video-audio']);

/**
 * Selects the best media starter packs for the current language and active tab.
 */
export function selectMediaStarterPacks(
  packs: readonly StarterPack[],
  lang: AppLanguage,
  filter: MediaTabFilter = 'all',
): StarterPack[] {
  const pool = packs.filter(pack => {
    if (filter === 'audio') return AUDIO_PACK_IDS.has(pack.id);
    if (filter === 'video' || filter === 'clips') return VIDEO_PACK_IDS.has(pack.id);
    return AUDIO_PACK_IDS.has(pack.id) || VIDEO_PACK_IDS.has(pack.id);
  });

  const prioritized = [...pool].sort((a, b) => {
    const aMatch = a.language === lang ? 2 : a.language === 'all' ? 1 : 0;
    const bMatch = b.language === lang ? 2 : b.language === 'all' ? 1 : 0;
    return bMatch - aMatch;
  });

  // Hide non-matching single-language packs (e.g., don't show DACH packs to non-DE users)
  const clean = prioritized.filter(pack => pack.language === 'all' || pack.language === lang);
  return clean.slice(0, filter === 'all' ? 4 : 3);
}
