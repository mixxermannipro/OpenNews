import type { AppLanguage, NewsArticle, NewsSource } from '../types/news';
import type { StarterPack } from './catalog';

export const FIRST_BATCH_SIZE = 4;
export const FOLLOWUP_BATCH_SIZE = 8;

const MAX_WIRE_PARAGRAPHS = 6;
const MAX_WIRE_PARAGRAPH_CHARS = 500;
const MAX_WIRE_SUMMARY_CHARS = 520;
const MEDIA_ONLY_PACK_PREFIXES = ['clips-', 'podcasts-', 'video-'];

/**
 * Splits active sources into prioritized batches:
 * - Batch 0 is compact (up to 4) and prioritizes recommended/custom news sources so the
 *   above-the-fold feed renders as fast as possible without waiting on slower feeds.
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
 * Trims oversized RSS paragraph payloads before wire transfer or caching so feed
 * responses stay fast, data-efficient, and low-memory while preserving preview text.
 */
export function slimFeedArticle(article: NewsArticle): NewsArticle {
  const summary = article.summary.length > MAX_WIRE_SUMMARY_CHARS
    ? article.summary.slice(0, MAX_WIRE_SUMMARY_CHARS)
    : article.summary;
  const paragraphs = article.paragraphs
    .filter(Boolean)
    .slice(0, MAX_WIRE_PARAGRAPHS)
    .map(p => (p.length > MAX_WIRE_PARAGRAPH_CHARS ? p.slice(0, MAX_WIRE_PARAGRAPH_CHARS) : p));

  // Avoid duplicating a single paragraph identical to the summary over the wire
  const dedupedParagraphs =
    paragraphs.length === 1 && paragraphs[0].trim() === summary.trim() ? [] : paragraphs;

  return {
    ...article,
    summary,
    paragraphs: dedupedParagraphs,
  };
}

/**
 * Selects quick-start packs for the Home empty state, always placing written news packs
 * ahead of podcast/video-only packs so users immediately see articles on "Heute".
 */
export function selectHomeStarterPacks(
  packs: readonly StarterPack[],
  lang: AppLanguage,
  limit = 4,
): StarterPack[] {
  const isMediaOnly = (pack: StarterPack) =>
    MEDIA_ONLY_PACK_PREFIXES.some(prefix => pack.id.startsWith(prefix));

  const score = (pack: StarterPack) => {
    const newsBonus = isMediaOnly(pack) ? 0 : 10;
    const langBonus = pack.language === lang ? 4 : pack.language === 'all' ? 2 : pack.language === 'en' ? 1 : 0;
    return newsBonus + langBonus;
  };

  return [...packs]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
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
