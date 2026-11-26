import { Capacitor } from '@capacitor/core';
import type { NewsArticle } from '../types/news';
import { readOfflineArticle, storeOfflineArticle } from './offlineArticle';
import { selectArticlesToPreload, shouldPreloadOffline, type ConnectionLike } from './readerExtras';

const preloadedSessionLinks = new Set<string>();
const SESSION_PRELOAD_BUDGET = 3;
let sessionPreloadAttempts = 0;

/**
 * Gently preloads a small budget of saved/queued or top Today text articles into CacheStorage
 * in the background when online and not on Save-Data / slow cellular connections.
 */
export async function runIntelligentOfflinePreload(
  todayArticles: NewsArticle[],
  savedArticles: NewsArticle[],
  options: { maxCount?: number; signal?: AbortSignal } = {},
): Promise<number> {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined' || !('caches' in window)) return 0;

  const remainingBudget = Math.max(0, SESSION_PRELOAD_BUDGET - sessionPreloadAttempts);
  if (remainingBudget === 0) return 0;

  const nav = navigator as Navigator & { connection?: ConnectionLike };
  if (!shouldPreloadOffline(navigator.onLine, nav.connection)) return 0;

  const limit = Math.min(options.maxCount ?? remainingBudget, remainingBudget);
  const candidates = selectArticlesToPreload(
    todayArticles,
    savedArticles,
    preloadedSessionLinks,
    limit,
  );
  if (!candidates.length) return 0;

  let storedCount = 0;
  for (const article of candidates) {
    if (options.signal?.aborted) break;
    if (sessionPreloadAttempts >= SESSION_PRELOAD_BUDGET) break;
    if (!shouldPreloadOffline(navigator.onLine, nav.connection)) break;

    preloadedSessionLinks.add(article.link);
    try {
      const existing = await readOfflineArticle(article.link).catch(() => undefined);
      if (existing) continue;

      sessionPreloadAttempts++;
      const response = await fetch(`/api/article/extract?url=${encodeURIComponent(article.link)}&preload=1`, {
        signal: options.signal,
      });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        paragraphs?: string[];
        headingIndexes?: number[];
        ogImage?: string;
        unavailable?: boolean;
      };
      if (data.unavailable && !article.paragraphs.length && !article.summary) continue;
      const paragraphs = data.paragraphs?.length ? data.paragraphs : article.paragraphs.length ? article.paragraphs : [article.summary];
      if (!paragraphs.filter(Boolean).length) continue;

      await storeOfflineArticle(
        article.link,
        paragraphs,
        data.headingIndexes ?? [],
        article.imageUrl || data.ogImage,
      );
      storedCount++;
    } catch {
      // Non-fatal: background preload skips blocked or slow publishers silently.
    }
  }
  return storedCount;
}
