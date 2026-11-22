import type { AISummaryResult, NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';

export function createDefaultProfile(): PersonalizationProfile {
  return {
    likedIds: [],
    dislikedIds: [],
    bookmarkedIds: [],
    readIds: [],
    topicWeights: {},
    sourceWeights: {},
    keywordWeights: {},
    readingSecondsByTopic: {},
    readingSecondsBySource: {},
    totalReadingSeconds: 0,
  };
}

export function normalizeProfile(raw: Partial<PersonalizationProfile> | null | undefined): PersonalizationProfile {
  const base = createDefaultProfile();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    topicWeights: raw.topicWeights || {},
    sourceWeights: raw.sourceWeights || {},
    keywordWeights: raw.keywordWeights || {},
    readingSecondsByTopic: raw.readingSecondsByTopic || {},
    readingSecondsBySource: raw.readingSecondsBySource || {},
    totalReadingSeconds: typeof raw.totalReadingSeconds === 'number' ? raw.totalReadingSeconds : 0,
  };
}

const WEIGHT_HALF_LIFE_MS = 21 * 24 * 60 * 60 * 1000;

function weightUpdateTime() {
  const hour = 60 * 60 * 1000;
  return Math.floor(Date.now() / hour) * hour;
}

export function decayProfileWeights(profile: PersonalizationProfile, now = Date.now()): PersonalizationProfile {
  if (profile.weightsUpdatedAt === undefined) return { ...profile, weightsUpdatedAt: now };
  if (now <= profile.weightsUpdatedAt) return profile;
  const factor = 2 ** (-(now - profile.weightsUpdatedAt) / WEIGHT_HALF_LIFE_MS);
  const decay = (weights: Record<string, number>) => Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value * factor]).filter(([, value]) => Math.abs(Number(value)) >= 0.01)
  );
  return {
    ...profile,
    weightsUpdatedAt: now,
    topicWeights: decay(profile.topicWeights),
    sourceWeights: decay(profile.sourceWeights),
    keywordWeights: decay(profile.keywordWeights),
  };
}

export function resetProfileWeights(profile: PersonalizationProfile): PersonalizationProfile {
  return { ...profile, topicWeights: {}, sourceWeights: {}, keywordWeights: {}, weightsUpdatedAt: weightUpdateTime() };
}

function adjustWeight(map: Record<string, number>, key: string, delta: number): Record<string, number> {
  const next = { ...map };
  const val = Math.round(((next[key] ?? 0) + delta) * 100) / 100;
  if (Math.abs(val) < 0.05) {
    delete next[key];
  } else {
    next[key] = Math.max(-15, Math.min(30, val));
  }
  return next;
}

export function toggleArticleLike(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
  profile = decayProfileWeights(profile, weightUpdateTime());
  const alreadyLiked = profile.likedIds.includes(article.id);
  const wasDisliked = profile.dislikedIds.includes(article.id);
  const topicDelta = alreadyLiked ? -3 : wasDisliked ? 5.5 : 3;
  const sourceDelta = alreadyLiked ? -3 : wasDisliked ? 4.5 : 3;
  const keywordDelta = alreadyLiked ? -1 : wasDisliked ? 2.2 : 1;

  let topicWeights = adjustWeight(profile.topicWeights, article.category, topicDelta);
  let sourceWeights = adjustWeight(profile.sourceWeights, article.sourceId, sourceDelta);
  let keywordWeights = { ...profile.keywordWeights };
  for (const kw of article.keywords.slice(0, 6)) {
    keywordWeights = adjustWeight(keywordWeights, kw, keywordDelta);
  }

  return {
    ...profile,
    likedIds: alreadyLiked
      ? profile.likedIds.filter((id) => id !== article.id)
      : [article.id, ...profile.likedIds],
    dislikedIds: alreadyLiked
      ? profile.dislikedIds
      : profile.dislikedIds.filter((id) => id !== article.id),
    topicWeights,
    sourceWeights,
    keywordWeights,
  };
}

export function toggleArticleDislike(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
  profile = decayProfileWeights(profile, weightUpdateTime());
  const alreadyDisliked = profile.dislikedIds.includes(article.id);
  const wasLiked = profile.likedIds.includes(article.id);
  const topicDelta = alreadyDisliked ? 2.5 : wasLiked ? -5.5 : -2.5;
  const sourceDelta = alreadyDisliked ? 1.5 : wasLiked ? -4.5 : -1.5;
  const keywordDelta = alreadyDisliked ? 1.2 : wasLiked ? -2.2 : -1.2;

  let keywordWeights = { ...profile.keywordWeights };
  for (const kw of article.keywords.slice(0, 6)) {
    keywordWeights = adjustWeight(keywordWeights, kw, keywordDelta);
  }

  const topicWeights = adjustWeight(profile.topicWeights, article.category, topicDelta);
  const sourceWeights = adjustWeight(profile.sourceWeights, article.sourceId, sourceDelta);

  return {
    ...profile,
    dislikedIds: alreadyDisliked
      ? profile.dislikedIds.filter((id) => id !== article.id)
      : [article.id, ...profile.dislikedIds].slice(0, 400),
    likedIds: alreadyDisliked
      ? profile.likedIds
      : profile.likedIds.filter((id) => id !== article.id),
    keywordWeights,
    topicWeights,
    sourceWeights,
  };
}

/**
 * Explicit "Weniger davon" swipe action: hides the article and teaches the local
 * ranking algorithm to down-rank its topic, keywords, and gently its source.
 */
export function dismissArticleLessLikeThis(
  profile: PersonalizationProfile,
  article: NewsArticle,
): PersonalizationProfile {
  if (profile.dislikedIds.includes(article.id)) return profile;
  return toggleArticleDislike(profile, article);
}

export function toggleArticleBookmark(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
  profile = decayProfileWeights(profile, weightUpdateTime());
  const alreadySaved = profile.bookmarkedIds.includes(article.id);
  const delta = alreadySaved ? -1.5 : 1.5;

  return {
    ...profile,
    bookmarkedIds: alreadySaved
      ? profile.bookmarkedIds.filter((id) => id !== article.id)
      : [article.id, ...profile.bookmarkedIds],
    topicWeights: adjustWeight(profile.topicWeights, article.category, delta),
    sourceWeights: adjustWeight(profile.sourceWeights, article.sourceId, delta),
  };
}

export function recordArticleRead(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
  if (profile.readIds.includes(article.id)) return profile;
  return {
    ...profile,
    readIds: [article.id, ...profile.readIds].slice(0, 200),
  };
}

export function recordReadingDuration(
  profile: PersonalizationProfile,
  article: NewsArticle,
  seconds: number
): PersonalizationProfile {
  const clamped = Math.max(0, Math.min(600, Math.round(seconds)));
  if (!Number.isFinite(clamped) || clamped < 3) return profile;

  profile = decayProfileWeights(profile, weightUpdateTime());

  // Passive reading is a small signal, even when a reader stays open for minutes.
  const expectedSeconds = Math.max(20, article.readingTimeMin * 60);
  const weightDelta = Math.min(0.5, clamped / expectedSeconds * 0.5);
  const nextTopicSecs = {
    ...profile.readingSecondsByTopic,
    [article.category]: (profile.readingSecondsByTopic[article.category] ?? 0) + clamped,
  };
  const nextSourceSecs = {
    ...profile.readingSecondsBySource,
    [article.sourceId]: (profile.readingSecondsBySource[article.sourceId] ?? 0) + clamped,
  };

  return {
    ...profile,
    readingSecondsByTopic: nextTopicSecs,
    readingSecondsBySource: nextSourceSecs,
    totalReadingSeconds: (profile.totalReadingSeconds ?? 0) + clamped,
    topicWeights: adjustWeight(profile.topicWeights, article.category, weightDelta),
    sourceWeights: adjustWeight(profile.sourceWeights, article.sourceId, weightDelta * 0.8),
  };
}

export interface ScoredArticle {
  article: NewsArticle;
  score: number;
  reason?: string;
}

export function scoreArticle(
  article: NewsArticle,
  profile: PersonalizationProfile,
  subscribedSourceIds: Set<string>,
  nowMs: number = Date.now(),
  interestDecayHours = 72,
  lookupSets?: { dislikedIds: Set<string>; readIds: Set<string> },
): ScoredArticle {
  const isDisliked = lookupSets ? lookupSets.dislikedIds.has(article.id) : profile.dislikedIds.includes(article.id);
  if (isDisliked) {
    return { article, score: -100, reason: 'Weniger davon' };
  }

  const publishedMs = Date.parse(article.publishedAt) || nowMs;
  const ageHours = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60));
  const freshness = 12 * Math.exp(-ageHours / 20);
  const topicScore = Math.max(-3, Math.min(3, profile.topicWeights[article.category] ?? 0));
  const sourceScore = Math.max(-1.5, Math.min(1.5, (profile.sourceWeights[article.sourceId] ?? 0) * 0.5));
  let keywordWeight = 0;
  let positiveKeywords = 0;
  let negativeKeywords = 0;
  const seenKeywords = new Set<string>();
  for (const keyword of article.keywords) {
    const w = profile.keywordWeights[keyword] ?? 0;
    keywordWeight += w;
    if (!seenKeywords.has(keyword)) {
      seenKeywords.add(keyword);
      if (w > 0) positiveKeywords++;
      else if (w < 0) negativeKeywords++;
    }
  }
  const keywordScore = Math.max(-1.5, Math.min(1.5, keywordWeight * 0.4));
  const interest = topicScore + sourceScore + keywordScore;
  const specificInterest = Math.max(0, Math.min(3, positiveKeywords * 0.9 - negativeKeywords * 0.5));
  const breakingBonus = article.isBreaking ? 14 * Math.exp(-ageHours / 12) : 0;
  const isRead = lookupSets ? lookupSets.readIds.has(article.id) : profile.readIds.includes(article.id);
  const totalScore = freshness + breakingBonus
    + (interest + specificInterest) * Math.exp(-ageHours / interestDecayHours)
    + (subscribedSourceIds.has(article.sourceId) ? 0.5 : 0)
    - (isRead ? 3 : 0);

  let reason: string | undefined;
  if (breakingBonus >= 4) {
    reason = 'Eilmeldung';
  } else if (topicScore >= 2) {
    reason = `Passt zu deinem Interesse an ${article.category}`;
  } else if (sourceScore >= 1.5 || keywordScore >= 1) {
    reason = 'Passt zu deinen Interessen';
  }

  return { article, score: Number(totalScore.toFixed(2)), reason };
}

export function rankArticlesForYou(
  articles: NewsArticle[],
  profile: PersonalizationProfile,
  sources: NewsSource[],
  nowMs: number = Date.now(),
  diversify = true,
  interestDecayHours = 72,
): ScoredArticle[] {
  const subscribedIds = new Set(sources.filter((s) => s.subscribed).map((s) => s.id));
  const lookupSets = {
    dislikedIds: new Set(profile.dislikedIds),
    readIds: new Set(profile.readIds),
  };
  const ranked = articles
    .map((a) => scoreArticle(a, profile, subscribedIds, nowMs, interestDecayHours, lookupSets))
    .filter((entry) => entry.score > -50)
    .sort((a, b) => b.score - a.score || b.article.publishedAt.localeCompare(a.article.publishedAt)
      || a.article.id.localeCompare(b.article.id));

  return diversify ? diversifyArticles(ranked) : ranked;
}

export function diversifyArticles(
  ranked: ScoredArticle[], capSources = false,
  fourthSlot?: (entry: ScoredArticle) => boolean,
): ScoredArticle[] {
  const pool = [...ranked];
  const selected: ScoredArticle[] = [];
  let lastSourceId = '';
  // Mix each page of recommendations. Consider other topics even if one source
  // supplies most of the initial candidates, and gently avoid back-to-back repeats.
  while (pool.length) {
    const bySource = new Map<string, number>();
    const byTopic = new Map<string, number>();
    const adjustedScore = ({ article, score }: ScoredArticle) =>
      score
      - (capSources ? 4 : 2) * (bySource.get(article.sourceId) ?? 0)
      - 3 * (byTopic.get(article.category) ?? 0)
      - (article.sourceId === lastSourceId ? 1.2 : 0);
    for (let slot = 0; slot < 12 && pool.length; slot++) {
      let best = -1;
      let bestScore = -Infinity;
      const eligible = (entry: ScoredArticle) => !capSources || (bySource.get(entry.article.sourceId) ?? 0) < 2;
      const reserve = selected.length === 3 && fourthSlot && !selected.some(fourthSlot)
        ? pool.findIndex(entry => eligible(entry) && fourthSlot(entry)) : -1;
      for (let i = 0; i < pool.length && reserve < 0; i++) {
        if (pool[i].score < bestScore) break;
        if (!eligible(pool[i])) continue;
        const score = adjustedScore(pool[i]);
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      }
      if (reserve >= 0) best = reserve;
      if (best < 0) break;
      const [entry] = pool.splice(best, 1);
      selected.push(reserve >= 0 ? { ...entry, reason: 'Wichtiges Thema außerhalb deiner Interessen' } : entry);
      const { sourceId, category } = entry.article;
      lastSourceId = sourceId;
      bySource.set(sourceId, (bySource.get(sourceId) ?? 0) + 1);
      byTopic.set(category, (byTopic.get(category) ?? 0) + 1);
    }
  }
  return selected;
}

export function generateLocalExtractiveSummary(article: NewsArticle): AISummaryResult {
  const fullText = article.paragraphs.join(' ').trim() || article.summary.trim();
  const sentences = [...new Intl.Segmenter('de', { granularity: 'sentence' }).segment(fullText)]
    .map(item => item.segment.trim()).filter(sentence => sentence.length >= 24);
  const bullets = [...new Set(sentences)].slice(0, 3);
  return {
    bullets: bullets.length ? bullets : [fullText || article.title],
    mode: 'local',
    providerLabel: 'Lokale Textanalyse',
    generatedAt: new Date().toISOString(),
  };
}

export function formatRelativeTimeDe(isoDate: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 'Gerade eben';
  const diffMin = Math.max(1, Math.floor((nowMs - ts) / 60000));
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Gestern';
  return `Vor ${diffDays} Tagen`;
}

export function getTimeGreetingDe(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'Guten Morgen';
  if (h >= 11 && h < 18) return 'Guten Tag';
  return 'Guten Abend';
}
