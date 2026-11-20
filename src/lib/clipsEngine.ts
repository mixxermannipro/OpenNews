import type { NewsArticle } from '../types/news';
import type { PlayableMedia } from './articleMedia';

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
export interface MediaChannelSummary {
  sourceId: string;
  sourceName: string;
  sourceShortCode: string;
  sourceColor: string;
  count: number;
  hasClips: boolean;
  hasAudio: boolean;
}

export function extractMediaChannels(entries: readonly MediaEntry[]): MediaChannelSummary[] {
  const map = new Map<string, MediaChannelSummary>();
  for (const { article, media } of entries) {
    const id = article.sourceId || article.sourceName;
    const existing = map.get(id);
    if (existing) {
      existing.count += 1;
      if (media.portrait) existing.hasClips = true;
      if (media.type === 'audio') existing.hasAudio = true;
    } else {
      map.set(id, {
        sourceId: id,
        sourceName: article.sourceName,
        sourceShortCode: article.sourceShortCode,
        sourceColor: article.sourceColor,
        count: 1,
        hasClips: Boolean(media.portrait),
        hasAudio: media.type === 'audio',
      });
    }
  }
  return [...map.values()].sort((a, b) => Number(b.hasClips) - Number(a.hasClips) || b.count - a.count);
}
