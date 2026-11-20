import type { NewsSource } from '../types/news';

export const FIRST_BATCH_SIZE = 6;
export const FOLLOWUP_BATCH_SIZE = 8;

/**
 * Splits active sources into prioritized batches:
 * - Batch 0 is small (up to 6) and prioritizes recommended/custom news sources so the
 *   above-the-fold feed renders as fast as possible.
 * - Remaining sources are grouped into larger batches (up to 8) for concurrent fetching.
 */
export function planFeedBatches(
  sources: readonly NewsSource[],
  firstBatchSize = FIRST_BATCH_SIZE,
  followupBatchSize = FOLLOWUP_BATCH_SIZE,
): NewsSource[][] {
  if (!sources.length) return [];

  const prioritized = [...sources].sort((a, b) => {
    const score = (s: NewsSource) =>
      (s.format === 'podcast' ? 0 : 4) +
      (s.isCustom ? 2 : 0) +
      (s.recommended ? 1 : 0);
    return score(b) - score(a);
  });

  const batches: NewsSource[][] = [];
  const first = prioritized.slice(0, Math.max(1, firstBatchSize));
  batches.push(first);

  const step = Math.max(1, followupBatchSize);
  for (let i = first.length; i < prioritized.length; i += step) {
    batches.push(prioritized.slice(i, i + step));
  }
  return batches;
}

/**
 * Runs async tasks with bounded concurrency, preserving abort-safety.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<boolean | void>,
): Promise<void> {
  if (!items.length) return;
  let nextIndex = 0;
  let stopped = false;
  const limit = Math.max(1, Math.min(concurrency, items.length));

  const runWorker = async () => {
    while (!stopped && nextIndex < items.length) {
      const current = nextIndex++;
      const shouldStop = await worker(items[current], current);
      if (shouldStop === true) {
        stopped = true;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
}
