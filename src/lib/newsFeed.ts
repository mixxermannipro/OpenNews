import { contentUrlKey } from './contentIdentity';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { diversifyArticles, rankArticlesForYou, type ScoredArticle } from './personalization';
import { clusterStories } from './storyClusters';
import type { HomeTab, Retention } from './preferences';

export const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 600;
const PUBLIC_NEWS = new Set<NewsArticle['category']>(['Politik', 'Europa', 'Wirtschaft', 'Wissenschaft']);

export type HomeStory = ReturnType<typeof clusterStories>[number] & { reason?: string };

function rankStories(ranked: ScoredArticle[]): HomeStory[] {
  const groups = clusterStories(ranked.map(entry => entry.article));
  const groupsByLead = new Map(groups.map(group => [group.lead.id, group]));
  return diversifyArticles(ranked.filter(entry => groupsByLead.has(entry.article.id)), true)
    .map(({ article, reason }) => ({ ...groupsByLead.get(article.id)!, reason }));
}

function newestFirst(a: NewsArticle, b: NewsArticle): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
}

export function articleIdentity(article: NewsArticle): string {
  const link = !article.linkIsFeed && contentUrlKey(article.link, 'article');
  return link ? `url:${link}` : `id:${article.id}`;
}

export function distinctArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  return articles.filter(article => {
    const key = articleIdentity(article);
    if (seen.has(key) || seenIds.has(article.id)) return false;
    seen.add(key);
    seenIds.add(article.id);
    return true;
  });
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
  const cacheKey = (article: NewsArticle) => JSON.stringify([article.sourceId, articleIdentity(article)]);
  const byId = new Map(previous.map(article => [cacheKey(article), article]));
  const keysById = new Map([...byId].map(([key, article]) => [article.id, key]));
  for (const article of incoming) {
    const key = cacheKey(article);
    const oldKey = keysById.get(article.id);
    if (oldKey && oldKey !== key) byId.delete(oldKey);
    const id = byId.get(key)?.id ?? article.id;
    keysById.set(id, key);
    byId.set(key, {
      ...article,
      id,
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
): Record<HomeTab, HomeStory[]> {
  const podcastIds = new Set(sources.filter(source => source.format === 'podcast').map(source => source.id));
  const latest = distinctArticles(articles.filter(article => !podcastIds.has(article.sourceId) && Date.parse(article.publishedAt) <= now).sort(newestFirst));
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
      const score = 8 * Math.exp(-ageHours / 18) + publicNewsBonus + (article.isBreaking ? 8 * Math.exp(-ageHours / 12) : 0);
      return { article, score };
    })
    .sort((a, b) => b.score - a.score || newestFirst(a.article, b.article));

  const recent = latest.filter(article => {
    const published = Date.parse(article.publishedAt);
    return published > now - 2 * DAY_MS && published <= now;
  });

  const personal = rankArticlesForYou(recent, profile, sources, now, false);
  // Weight one fresh public-interest story when personal signals would bury it.
  const publicIndex = personal.findIndex(({ article }) =>
    (PUBLIC_NEWS.has(article.category) || article.isBreaking)
    && Date.parse(article.publishedAt) >= now - DAY_MS);
  if (publicIndex > 3) {
    const [entry] = personal.splice(publicIndex, 1);
    personal.splice(3, 0, { ...entry, score: personal[3].score, reason: 'Aktuelle öffentliche Meldung' });
  }

  return {
    Heute: rankStories(headlines),
    'Für dich': rankStories(personal),
    Neueste: clusterStories(latest),
  };
}
