import { contentUrlKey } from './contentIdentity';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { diversifyArticles, rankArticlesForYou, type ScoredArticle } from './personalization';
import { clusterStories } from './storyClusters';
import type { HomeTab, Retention } from './preferences';

export const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 600;
const PUBLIC_NEWS = new Set<NewsArticle['category']>(['Politik', 'Europa', 'Wirtschaft', 'Wissenschaft']);
const TEASER = /^(?:das (?:glaubst|glauben) (?:du|sie) nie|(?:du wirst|sie werden) nicht glauben|was dann geschah|you won.t believe)\b/iu;

export type HomeStory = ReturnType<typeof clusterStories>[number] & { reason?: string };

function rankStories(
  ranked: ScoredArticle[], now: number, fourthSlot?: (entry: ScoredArticle) => boolean,
): HomeStory[] {
  const candidates = ranked.map(entry => TEASER.test(entry.article.title.trimStart())
    ? { ...entry, score: entry.score - 6 } : entry).sort(byScore);
  const groups = clusterStories(candidates.map(entry => entry.article));
  const scores = new Map(candidates.map(entry => [entry.article.id, entry]));
  const groupsByLead = new Map(groups.map(group => [group.lead.id, group]));
  const leads = groups.map(({ lead, reports }) => {
    const entry = scores.get(lead.id)!;
    const sources = new Set(reports.map(report => report.sourceId));
    const ageHours = (now - Date.parse(lead.publishedAt)) / 3_600_000;
    const bonus = Math.min(2, sources.size - 1) * 2 * Math.exp(-ageHours / 18);
    return {
      ...entry, score: entry.score + bonus,
      reason: entry.reason ?? (bonus >= 1 ? 'Von mehreren Quellen berichtet' : undefined),
    };
  }).sort(byScore);
  return diversifyArticles(leads, true, fourthSlot)
    .map(({ article, reason }) => ({ ...groupsByLead.get(article.id)!, reason }));
}

function newestFirst(a: NewsArticle, b: NewsArticle): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
}

function byScore(a: ScoredArticle, b: ScoredArticle): number {
  return b.score - a.score || newestFirst(a.article, b.article);
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

export function hydrateArticles(articles: NewsArticle[], fresh: NewsArticle[]): NewsArticle[] {
  if (!articles.length || !fresh.length) return articles;
  const byKey = new Map(fresh.map(article => [articleIdentity(article), article]));
  let changed = false;
  const next = articles.map(article => {
    const match = byKey.get(articleIdentity(article));
    if (!match) return article;
    const summary = article.summary || match.summary;
    const paragraphs = article.paragraphs.length ? article.paragraphs : match.paragraphs;
    const imageUrl = article.imageUrl ?? match.imageUrl;
    const media = article.media?.length ? article.media : match.media;
    const transcript = article.transcript ?? match.transcript;
    if (
      summary === article.summary &&
      paragraphs === article.paragraphs &&
      imageUrl === article.imageUrl &&
      media === article.media &&
      transcript === article.transcript
    ) {
      return article;
    }
    changed = true;
    return {
      ...article,
      summary,
      paragraphs,
      ...(imageUrl !== undefined && { imageUrl }),
      ...(media !== undefined && { media }),
      ...(transcript !== undefined && { transcript }),
    };
  });
  return changed ? next : articles;
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
    .map((article): ScoredArticle => {
      const ageHours = (now - Date.parse(article.publishedAt)) / (60 * 60 * 1000);
      const publicNewsBonus = PUBLIC_NEWS.has(article.category) ? 2 * Math.exp(-ageHours / 12) : 0;
      const score = 8 * Math.exp(-ageHours / 18) + publicNewsBonus + (article.isBreaking ? 8 * Math.exp(-ageHours / 12) : 0);
      return { article, score, reason: article.isBreaking ? 'Eilmeldung' : undefined };
    });

  const recent = latest.filter(article => {
    const published = Date.parse(article.publishedAt);
    return published > now - 2 * DAY_MS && published <= now;
  });

  const personal = rankArticlesForYou(recent, profile, sources, now, false, 24);
  const hasInterests = [profile.topicWeights, profile.sourceWeights, profile.keywordWeights]
    .some(weights => Object.values(weights).some(weight => weight > 0));
  const publicOutsideInterests = ({ article }: ScoredArticle) =>
    (PUBLIC_NEWS.has(article.category) || article.isBreaking === true)
    && Date.parse(article.publishedAt) >= now - DAY_MS
    && (profile.topicWeights[article.category] ?? 0) <= 0
    && (profile.sourceWeights[article.sourceId] ?? 0) <= 0
    && !article.keywords.some(keyword => (profile.keywordWeights[keyword] ?? 0) > 0);

  return {
    Heute: rankStories(headlines, now),
    'Für dich': rankStories(personal, now, hasInterests ? publicOutsideInterests : undefined),
    Neueste: clusterStories(latest),
  };
}
