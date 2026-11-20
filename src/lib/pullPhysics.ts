/**
 * Pure gesture & reading-progress physics for butter-smooth mobile interactions.
 */

export const PULL_REFRESH_THRESHOLD = 72;
const PULL_MAX_INDICATOR = 68;
const PULL_RESISTANCE = 55;
const PULL_MAX_CONTENT_SHIFT = 44;

export interface PullState {
  distance: number;
  indicatorOffset: number;
  contentShift: number;
  progress: number;
  ready: boolean;
}

/**
 * Computes rubber-band damped offsets for pull-to-refresh without layout thrashing.
 */
export function computePullState(rawDistance: number, threshold = PULL_REFRESH_THRESHOLD): PullState {
  const distance = Math.max(0, Number.isFinite(rawDistance) ? rawDistance : 0);
  const indicatorOffset = distance === 0 ? 0 : (PULL_MAX_INDICATOR * distance) / (distance + PULL_RESISTANCE);
  const contentShift = distance === 0 ? 0 : (PULL_MAX_CONTENT_SHIFT * distance) / (distance + PULL_RESISTANCE * 1.35);
  const progress = threshold > 0 ? Math.min(1, distance / threshold) : 0;
  return {
    distance,
    indicatorOffset: Math.round(indicatorOffset * 10) / 10,
    contentShift: Math.round(contentShift * 10) / 10,
    progress: Math.round(progress * 1000) / 1000,
    ready: distance >= threshold,
  };
}

/**
 * Computes normalized 0..1 reading progress for a scrollable container.
 */
export function computeReadingProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const maxScroll = scrollHeight - clientHeight;
  if (!Number.isFinite(scrollTop) || !Number.isFinite(maxScroll) || maxScroll <= 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(scrollTop, maxScroll));
  return Math.round((clamped / maxScroll) * 1000) / 1000;
}
