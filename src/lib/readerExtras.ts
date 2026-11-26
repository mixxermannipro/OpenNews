import type { NewsArticle } from '../types/news';

export type ReaderSurfaceTheme = 'default' | 'sepia' | 'paper' | 'night';

export interface ArticleHighlight {
  id: string;
  articleId: string;
  articleTitle: string;
  articleLink: string;
  sourceName: string;
  quote: string;
  note?: string;
  createdAt: string;
}

export interface SpeechBlock {
  id: string;
  kind: 'title' | 'lead' | 'body';
  bodyIndex?: number;
  text: string;
}

export interface AudioPositionEntry {
  url: string;
  seconds: number;
  duration: number;
  updatedAt: number;
}

export interface ReadingProgressEntry {
  articleId: string;
  ratio: number;
  updatedAt: number;
}

export interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Builds ordered paragraph blocks for Reader Speech 2.0 synchronized reading.
 */
export function buildSpeechBlocks(title: string, lead: string | undefined, bodyParagraphs: string[]): SpeechBlock[] {
  const blocks: SpeechBlock[] = [];
  const cleanTitle = title.trim();
  if (cleanTitle) blocks.push({ id: 'title', kind: 'title', text: cleanTitle });

  const cleanLead = lead?.trim();
  if (cleanLead && cleanLead !== cleanTitle) {
    blocks.push({ id: 'lead', kind: 'lead', text: cleanLead });
  }

  bodyParagraphs.forEach((paragraph, index) => {
    const cleaned = paragraph.trim();
    if (cleaned.length >= 2) {
      blocks.push({ id: `body-${index}`, kind: 'body', bodyIndex: index, text: cleaned });
    }
  });

  return blocks;
}

/**
 * Estimates total reading time in minutes for a queue of articles.
 */
export function estimateQueueMinutes(articles: Array<Pick<NewsArticle, 'readingTimeMin'>>): number {
  return articles.reduce((total, article) => total + Math.max(1, article.readingTimeMin || 1), 0);
}

/**
 * Selects high-priority articles for intelligent background offline preloading.
 */
export function selectArticlesToPreload(
  todayArticles: NewsArticle[],
  savedArticles: NewsArticle[],
  alreadyCachedLinks: Set<string>,
  maxCount = 10,
): NewsArticle[] {
  const selected: NewsArticle[] = [];
  const seen = new Set<string>(alreadyCachedLinks);

  const enqueue = (list: NewsArticle[]) => {
    for (const article of list) {
      if (selected.length >= maxCount) break;
      if (!article.link || article.linkIsFeed || seen.has(article.link)) continue;
      if (!/^https?:\/\//i.test(article.link)) continue;
      seen.add(article.link);
      selected.push(article);
    }
  };

  // Saved / queued items first, then top stories from Today
  enqueue(savedArticles);
  enqueue(todayArticles);
  return selected;
}

/**
 * Respects offline status, Data Saver mode, and slow cellular connections.
 */
export function shouldPreloadOffline(isOnline: boolean, connection?: ConnectionLike | null): boolean {
  if (!isOnline) return false;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return false;
  return true;
}

/**
 * Updates persisted playback position map; clears entry if playback reached >95% completion.
 */
export function upsertAudioPosition(
  positions: Record<string, AudioPositionEntry>,
  url: string,
  seconds: number,
  duration: number,
  now = Date.now(),
  maxEntries = 40,
): Record<string, AudioPositionEntry> {
  if (!url || !Number.isFinite(seconds) || seconds < 0) return positions;
  const next = { ...positions };
  if (duration > 15 && seconds / duration >= 0.95) {
    delete next[url];
    return next;
  }
  if (seconds < 3) return positions;

  next[url] = { url, seconds: Math.floor(seconds), duration: Math.floor(duration || 0), updatedAt: now };

  const entries = Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt);
  if (entries.length <= maxEntries) return next;
  const trimmed: Record<string, AudioPositionEntry> = {};
  for (const item of entries.slice(0, maxEntries)) trimmed[item.url] = item;
  return trimmed;
}

/**
 * Updates persisted scroll reading progress (0..1); ignores <12%, removes >=92% as completed, caps at 80 entries.
 */
export function upsertReadingProgress(
  progressMap: Record<string, ReadingProgressEntry>,
  articleId: string,
  ratio: number,
  now = Date.now(),
  maxEntries = 80,
): Record<string, ReadingProgressEntry> {
  if (!articleId || !Number.isFinite(ratio)) return progressMap;
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped >= 0.92) {
    if (!(articleId in progressMap)) return progressMap;
    const next = { ...progressMap };
    delete next[articleId];
    return next;
  }
  if (clamped < 0.12) return progressMap;

  const rounded = Math.round(clamped * 100) / 100;
  const existing = progressMap[articleId];
  if (existing && Math.abs(existing.ratio - rounded) < 0.02 && now - existing.updatedAt < 5000) {
    return progressMap;
  }

  const next: Record<string, ReadingProgressEntry> = {
    ...progressMap,
    [articleId]: { articleId, ratio: rounded, updatedAt: now },
  };
  const entries = Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt);
  if (entries.length <= maxEntries) return next;
  const trimmed: Record<string, ReadingProgressEntry> = {};
  for (const item of entries.slice(0, maxEntries)) trimmed[item.articleId] = item;
  return trimmed;
}

/**
 * Resolves previous/next neighbor articles within an ordered reader context list.
 */
export function resolveNeighborArticles(
  articleId: string,
  list: readonly NewsArticle[],
): { previous?: NewsArticle; next?: NewsArticle; index: number; total: number } {
  const index = list.findIndex(item => item.id === articleId);
  if (index < 0) return { index: -1, total: list.length };
  return {
    previous: index > 0 ? list[index - 1] : undefined,
    next: index + 1 < list.length ? list[index + 1] : undefined,
    index,
    total: list.length,
  };
}

/**
 * Selects distinct-source alternative reports covering the same story when full text is paywalled or truncated.
 */
export function selectFreeAlternatives(
  article: NewsArticle,
  perspectives: readonly NewsArticle[],
  maxCount = 3,
): NewsArticle[] {
  const seenSources = new Set<string>([article.sourceId]);
  const candidates: NewsArticle[] = [];
  for (const item of perspectives) {
    if (item.id === article.id || seenSources.has(item.sourceId)) continue;
    seenSources.add(item.sourceId);
    candidates.push(item);
  }
  return candidates
    .sort((a, b) => {
      const lenA = a.paragraphs.join(' ').length + a.summary.length;
      const lenB = b.paragraphs.join(' ').length + b.summary.length;
      return lenB - lenA;
    })
    .slice(0, maxCount);
}

/**
 * Filters stories to unread items when unread-only mode is enabled.
 */
export function filterUnreadStories<T extends { lead: Pick<NewsArticle, 'id'> }>(
  stories: readonly T[],
  readIds: ReadonlySet<string>,
  unreadOnly: boolean,
): T[] {
  if (!unreadOnly) return [...stories];
  return stories.filter(story => !readIds.has(story.lead.id));
}

/**
 * Formats collected local highlights into clean copyable Markdown.
 */
export function exportHighlightsMarkdown(highlights: ArticleHighlight[]): string {
  return highlights
    .map(item => {
      const noteLine = item.note?.trim() ? `\n- Notiz: ${item.note.trim()}` : '';
      return `> ${item.quote.trim()}\n— **${item.articleTitle}** (${item.sourceName}) ${item.articleLink}${noteLine}`;
    })
    .join('\n\n');
}
