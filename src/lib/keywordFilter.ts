import type { NewsArticle } from '../types/news';
import { foldSearchText } from './textSearch';

export type MuteDuration = '24h' | '7d' | 'forever';

export interface MutedKeywordRule {
  id: string;
  keyword: string;
  createdAt: number;
  expiresAt?: number; // undefined = forever
}

export interface KeywordRadarMatch {
  keyword: string;
  articles: NewsArticle[];
}

export function normalizeFilterText(value: string | undefined | null): string {
  return foldSearchText(String(value ?? ''))
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createMuteRule(keyword: string, duration: MuteDuration, now = Date.now()): MutedKeywordRule | null {
  const cleaned = keyword.trim();
  if (cleaned.length < 2) return null;
  const expiresAt =
    duration === '24h'
      ? now + 24 * 60 * 60 * 1000
      : duration === '7d'
        ? now + 7 * 24 * 60 * 60 * 1000
        : undefined;
  return {
    id: `${normalizeFilterText(cleaned)}-${now}`,
    keyword: cleaned,
    createdAt: now,
    expiresAt,
  };
}

export function pruneExpiredMutes(rules: MutedKeywordRule[], now = Date.now()): MutedKeywordRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.filter(
    rule => Boolean(rule && typeof rule.keyword === 'string' && rule.keyword.trim().length >= 2) && (!rule.expiresAt || rule.expiresAt > now),
  );
}

export function articleMatchesKeyword(
  article: Pick<NewsArticle, 'title' | 'summary' | 'keywords' | 'sourceName' | 'category'>,
  keyword: string,
): boolean {
  const needle = normalizeFilterText(keyword);
  if (needle.length < 2) return false;
  const haystack = normalizeFilterText(
    `${article.title} ${article.summary} ${(article.keywords ?? []).join(' ')} ${article.category}`,
  );
  if (!haystack) return false;
  // Whole-word / prefix boundary match to avoid accidental substring hits on short words
  if (needle.includes(' ')) return haystack.includes(needle);
  const words = haystack.split(' ');
  return words.some(word => word === needle || (needle.length >= 4 && word.startsWith(needle)));
}

export function filterMutedArticles<T extends Pick<NewsArticle, 'title' | 'summary' | 'keywords' | 'sourceName' | 'category'>>(
  articles: T[],
  rules: MutedKeywordRule[],
  now = Date.now(),
): T[] {
  const active = pruneExpiredMutes(rules, now);
  if (!active.length) return articles;
  return articles.filter(article => !active.some(rule => articleMatchesKeyword(article, rule.keyword)));
}

export function buildKeywordRadarMatches(
  articles: NewsArticle[],
  trackedKeywords: string[],
  maxPerKeyword = 6,
): KeywordRadarMatch[] {
  const cleaned = [...new Set(trackedKeywords.map(k => k.trim()).filter(k => k.length >= 2))];
  if (!cleaned.length) return [];

  return cleaned.map(keyword => ({
    keyword,
    articles: articles
      .filter(article => articleMatchesKeyword(article, keyword))
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
      .slice(0, maxPerKeyword),
  }));
}
