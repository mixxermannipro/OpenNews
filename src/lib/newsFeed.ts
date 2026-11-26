import { contentUrlKey } from './contentIdentity';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { diversifyArticles, rankArticlesForYou, type ScoredArticle } from './personalization';
import { clusterStories } from './storyClusters';
import type { HomeTab, Retention } from './preferences';

export const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 420;
const PUBLIC_NEWS = new Set<NewsArticle['category']>(['Politik', 'Europa', 'Wirtschaft', 'Wissenschaft']);
const TEASER = /^(?:das (?:glaubst|glauben) (?:du|sie) nie|(?:du wirst|sie werden) nicht glauben|was dann geschah|unglaublich(?:er|e|es)?|schock(?:-|\s)|you won['’]?t believe|what happened next|shocking:|vous n['’]allez pas croire|ce qui s['’]est passé ensuite|no vas a creer|lo que pasó después|non crederai|você não vai acreditar)\b/iu;
const ADVERTORIAL = /^(?:anzeige|werbung|sponsored|promotion|partnerbeitrag|advertorial)\s*[:|\-–—]/iu;
const PROMO_NOISE = /\b(?:black[- ]friday[- ]deals?|cyber[- ]monday|top[- ]deals?|schnäppchen|rabatt[- ]check|gutschein(?:e|code)?|besten deals|bei amazon|kreuzworträtsel|sudoku|horoskop|gewinnspiel)\b|^(?:ein\s+)?quiz\b|^hier\s+(?:die\s+neue\s+folge|live|im\s+stream|sehen)\b/iu;
const LIVEBLOG = /\b(?:liveblog|liveticker|business-ticker|newsblog)\b/i;

export function isAdvertorial(article: Pick<NewsArticle, 'title' | 'link'>): boolean {
  return ADVERTORIAL.test(article.title.trimStart()) || /\/anzeige(?:n)?\//i.test(article.link);
}

export function isPromotionalNoise(article: Pick<NewsArticle, 'title' | 'link'>): boolean {
  return isAdvertorial(article) || PROMO_NOISE.test(article.title.trimStart());
}

function hasSubstantiveSummary(article: NewsArticle): boolean {
  const summary = article.summary.trim();
  return summary.length >= 70 && summary !== article.title.trim();
}

export type HomeStory = ReturnType<typeof clusterStories>[number] & { reason?: string };

function rankStories(
  ranked: ScoredArticle[], now: number, fourthSlot?: (entry: ScoredArticle) => boolean,
): HomeStory[] {
  const candidates = ranked
    .filter(entry => !isAdvertorial(entry.article))
    .map(entry => {
      let penalty = 0;
      if (TEASER.test(entry.article.title.trimStart())) penalty += 6;
      if (PROMO_NOISE.test(entry.article.title.trimStart())) penalty += 8;
      return penalty > 0 ? { ...entry, score: entry.score - penalty } : entry;
    })
    .sort(byScore);
  const groups = clusterStories(candidates.map(entry => entry.article));
  const scores = new Map(candidates.map(entry => [entry.article.id, entry]));
  const groupsByLead = new Map<string, { lead: NewsArticle; reports: NewsArticle[] }>();

  const leads = groups.map(({ reports }) => {
    // Keep at most one report per sourceId to avoid self-duplicate "Weitere Berichte"
    const bySource = new Map<string, NewsArticle>();
    for (const report of reports) {
      const existing = bySource.get(report.sourceId);
      if (!existing) {
        bySource.set(report.sourceId, report);
      } else {
        const curScore = (scores.get(report.id)?.score ?? 0) + (report.imageUrl ? 1 : 0);
        const prevScore = (scores.get(existing.id)?.score ?? 0) + (existing.imageUrl ? 1 : 0);
        if (curScore > prevScore) bySource.set(report.sourceId, report);
      }
    }
    const deduped = [...bySource.values()];

    // Choose the best editorial lead in the cluster (favoring real photos, rich summaries & dedicated articles over liveblogs)
    const leadQuality = (art: NewsArticle) =>
      (scores.get(art.id)?.score ?? 0)
      + (art.imageUrl ? 1.5 : 0)
      + (hasSubstantiveSummary(art) ? 0.45 : 0)
      - (LIVEBLOG.test(art.title) ? 0.65 : 0);
    deduped.sort((a, b) => leadQuality(b) - leadQuality(a) || newestFirst(a, b));

    const bestLead = deduped[0];
    groupsByLead.set(bestLead.id, { lead: bestLead, reports: deduped });

    const entry = scores.get(bestLead.id)!;
    const ageHours = Math.max(0, (now - Date.parse(bestLead.publishedAt)) / 3_600_000);
    const bonus = Math.min(4, deduped.length - 1) * 2.4 * Math.exp(-ageHours / 18);
    return {
      ...entry,
      score: entry.score + bonus,
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
  const publishedMsMap = new Map<string, number>();
  const getPublishedMs = (article: NewsArticle) => {
    let ts = publishedMsMap.get(article.id);
    if (ts === undefined) {
      ts = Date.parse(article.publishedAt);
      publishedMsMap.set(article.id, ts);
    }
    return ts;
  };

  const latest = distinctArticles(
    articles
      .filter(article => !podcastIds.has(article.sourceId) && getPublishedMs(article) <= now)
      .sort((a, b) => getPublishedMs(b) - getPublishedMs(a) || a.id.localeCompare(b.id))
  );
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const dislikedSet = new Set(profile.dislikedIds);
  let todayPool = latest.filter(article => {
    if (dislikedSet.has(article.id) || isAdvertorial(article)) return false;
    const published = getPublishedMs(article);
    return published >= todayStartMs && published <= now;
  });

  // Early-morning grace backfill (00:00–06:00 local) so Heute is never barren right after midnight
  if (todayPool.length < 8 && now - todayStartMs < 6 * 3_600_000) {
    const overnightCutoff = now - 18 * 3_600_000;
    todayPool = latest.filter(article => {
      if (dislikedSet.has(article.id) || isAdvertorial(article)) return false;
      const published = getPublishedMs(article);
      return published >= overnightCutoff && published <= now;
    });
  }

  const headlines = todayPool.map((article): ScoredArticle => {
    const ageHours = Math.max(0, (now - getPublishedMs(article)) / (60 * 60 * 1000));
    const publicNewsBonus = PUBLIC_NEWS.has(article.category) ? 2 * Math.exp(-ageHours / 12) : 0;
    const editorialBonus = (article.imageUrl ? 0.85 : 0) * Math.exp(-ageHours / 24)
      + (hasSubstantiveSummary(article) ? 0.4 : 0);
    const negTopic = Math.min(0, Math.max(-2.5, (profile.topicWeights[article.category] ?? 0) * 0.6));
    const negSource = Math.min(0, Math.max(-1.5, (profile.sourceWeights[article.sourceId] ?? 0) * 0.4));
    const negKwSum = article.keywords.reduce((sum, kw) => sum + Math.min(0, profile.keywordWeights[kw] ?? 0), 0);
    const negKw = Math.max(-2, negKwSum * 0.35);
    const score = 8 * Math.exp(-ageHours / 18) + publicNewsBonus + editorialBonus
      + (article.isBreaking ? 8 * Math.exp(-ageHours / 12) : 0)
      + negTopic + negSource + negKw;
    return { article, score, reason: article.isBreaking ? 'Eilmeldung' : undefined };
  });

  const recentCutoff = now - 2 * DAY_MS;
  const recent = latest.filter(article => {
    if (isAdvertorial(article)) return false;
    const published = getPublishedMs(article);
    return published > recentCutoff && published <= now;
  });

  const personal = rankArticlesForYou(recent, profile, sources, now, false, 24);
  const hasInterests = [profile.topicWeights, profile.sourceWeights, profile.keywordWeights]
    .some(weights => Object.values(weights).some(weight => weight > 0));
  const publicOutsideInterests = ({ article }: ScoredArticle) =>
    (PUBLIC_NEWS.has(article.category) || article.isBreaking === true)
    && getPublishedMs(article) >= now - DAY_MS
    && (profile.topicWeights[article.category] ?? 0) <= 0
    && (profile.sourceWeights[article.sourceId] ?? 0) <= 0
    && !article.keywords.some(keyword => (profile.keywordWeights[keyword] ?? 0) > 0);

  return {
    Heute: rankStories(headlines, now),
    'Für dich': rankStories(personal, now, hasInterests ? publicOutsideInterests : undefined),
    Neueste: clusterStories(latest),
  };
}
