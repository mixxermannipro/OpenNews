export type SwipeAxis = 'none' | 'horizontal' | 'vertical';

export interface SwipeMoveResult {
  axis: SwipeAxis;
  offsetX: number;
  progress: number;
  pastThreshold: boolean;
  direction: -1 | 0 | 1;
}

export const SWIPE_LOCK_MIN_PX = 14;
export const SWIPE_HORIZONTAL_RATIO = 1.45;
export const SWIPE_COMMIT_RATIO = 0.28;
export const SWIPE_MIN_COMMIT_PX = 92;
export const SWIPE_MAX_COMMIT_PX = 160;
export const SWIPE_FLICK_VELOCITY = 0.55; // px/ms
export const SWIPE_FLICK_MIN_PX = 52;

export function swipeThreshold(cardWidth: number): number {
  const safeWidth = Number.isFinite(cardWidth) && cardWidth > 0 ? cardWidth : 360;
  return Math.max(SWIPE_MIN_COMMIT_PX, Math.min(SWIPE_MAX_COMMIT_PX, Math.round(safeWidth * SWIPE_COMMIT_RATIO)));
}

/**
 * Resolves axis lock and smooth horizontal displacement for swipe-to-dismiss cards.
 * Never steals vertical scrolling or diagonal scroll gestures.
 */
export function evaluateSwipeMove(
  dx: number,
  dy: number,
  cardWidth: number,
  currentAxis: SwipeAxis,
): SwipeMoveResult {
  let axis = currentAxis;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (axis === 'none') {
    if (absY >= SWIPE_LOCK_MIN_PX && absY >= absX) {
      axis = 'vertical';
    } else if (absX >= SWIPE_LOCK_MIN_PX && absX > absY * SWIPE_HORIZONTAL_RATIO) {
      axis = 'horizontal';
    }
  }

  if (axis !== 'horizontal') {
    return { axis, offsetX: 0, progress: 0, pastThreshold: false, direction: 0 };
  }

  const threshold = swipeThreshold(cardWidth);
  const sign = dx < 0 ? -1 : dx > 0 ? 1 : 0;
  // Gentle rubber-band damping past threshold so swipe feels tactile & controlled
  const dampenedAbs = absX <= threshold
    ? absX
    : threshold + (absX - threshold) * 0.45;
  const offsetX = sign * Math.min(dampenedAbs, Math.max(cardWidth * 0.65, 220));
  const progress = Math.min(1, absX / threshold);

  return {
    axis: 'horizontal',
    offsetX,
    progress,
    pastThreshold: absX >= threshold,
    direction: sign as -1 | 0 | 1,
  };
}

export function shouldCommitSwipe(
  dx: number,
  elapsedMs: number,
  cardWidth: number,
): boolean {
  const absX = Math.abs(dx);
  const threshold = swipeThreshold(cardWidth);
  if (absX >= threshold) return true;
  const velocity = elapsedMs > 0 ? absX / elapsedMs : 0;
  return absX >= SWIPE_FLICK_MIN_PX && velocity >= SWIPE_FLICK_VELOCITY;
}
