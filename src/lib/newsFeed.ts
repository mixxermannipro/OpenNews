import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { diversifyArticles, rankArticlesForYou } from './personalization';
import type { HomeTab, Retention } from './preferences';

export const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 600;
const PUBLIC_NEWS = new Set<NewsArticle['category']>(['Politik', 'Europa', 'Wirtschaft', 'Wissenschaft']);

function spaceSimilarHeadlines(articles: NewsArticle[]): NewsArticle[] {
  const first: { article: NewsArticle; words: Set<string> }[] = [];
  const later: NewsArticle[] = [];
  for (const article of articles) {
    const words = new Set(article.title.toLocaleLowerCase('de-DE').match(/[\p{L}\p{N}]{4,}/gu));
    const similar = words.size >= 4 && first.some(entry => {
      const overlap = [...words].filter(word => entry.words.has(word)).length;
      return overlap >= 4 && overlap / Math.max(words.size, entry.words.size) >= 0.65;
    });
    if (similar) later.push(article);
    else first.push({ article, words });
  }
  return [...first.map(({ article }) => article), ...later];
}

function newestFirst(a: NewsArticle, b: NewsArticle): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
}

export function pruneFeedArticles(articles: NewsArticle[], retention: Retention, now: number): NewsArticle[] {
  const cutoff = now - Number(retention) * DAY_MS;
  const fresh = articles.filter(article => Date.parse(article.publishedAt) > cutoff);
  return fresh.length === articles.length ? articles : fresh;
}

export function mergeFeedArticles(
  previous: NewsArticle[],
  incoming: NewsArticle[],
  retention: Retention,
  now: number,
): NewsArticle[] {
  const byId = new Map(previous.map(article => [article.id, article]));
  for (const article of incoming) {
    byId.set(article.id, {
      ...article,
      paragraphs: article.paragraphs.slice(0, 6).map(paragraph => paragraph.slice(0, 500)),
    });
  }
  return pruneFeedArticles([...byId.values()], retention, now).sort(newestFirst).slice(0, CACHE_LIMIT);
}

export function buildHomeSections(
  articles: NewsArticle[],
  profile: PersonalizationProfile,
  sources: NewsSource[],
  now: number,
): Record<HomeTab, NewsArticle[]> {
  const podcastIds = new Set(sources.filter(source => source.format === 'podcast').map(source => source.id));
  const latest = articles.filter(article => !podcastIds.has(article.sourceId)).sort(newestFirst);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const headlines = latest
    .filter(article => {
      const published = Date.parse(article.publishedAt);
      return published >= todayStart.getTime() && published <= now;
    })
    .map(article => {
      const ageHours = (now - Date.parse(article.publishedAt)) / (60 * 60 * 1000);
      const publicNewsBonus = PUBLIC_NEWS.has(article.category) ? 2 * Math.exp(-ageHours / 12) : 0;
      const score = 8 * Math.exp(-ageHours / 18) + publicNewsBonus + (article.isBreaking ? 8 : 0);
      return { article, score };
    })
    .sort((a, b) => b.score - a.score || newestFirst(a.article, b.article));

  const recent = latest.filter(article => {
    const published = Date.parse(article.publishedAt);
    return published > now - 2 * DAY_MS && published <= now;
  });

  return {
    Heute: spaceSimilarHeadlines(diversifyArticles(headlines).map(({ article }) => article)),
    'Für dich': spaceSimilarHeadlines(rankArticlesForYou(recent, profile, sources, now).map(({ article }) => article)),
    Neueste: latest,
  };
}
