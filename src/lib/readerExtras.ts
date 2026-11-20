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
