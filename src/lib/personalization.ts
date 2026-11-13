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

function adjustWeight(map: Record<string, number>, key: string, delta: number): Record<string, number> {
  const next = { ...map };
  const val = (next[key] ?? 0) + delta;
  if (Math.abs(val) < 0.05) {
    delete next[key];
  } else {
    next[key] = Math.max(-15, Math.min(30, Number(val.toFixed(2))));
  }
  return next;
}

export function toggleArticleLike(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
  const alreadyLiked = profile.likedIds.includes(article.id);
  const delta = alreadyLiked ? -3 : profile.dislikedIds.includes(article.id) ? 5.5 : 3;

  let topicWeights = adjustWeight(profile.topicWeights, article.category, delta);
  let sourceWeights = adjustWeight(profile.sourceWeights, article.sourceId, delta);
  let keywordWeights = { ...profile.keywordWeights };
  for (const kw of article.keywords.slice(0, 6)) {
    keywordWeights = adjustWeight(keywordWeights, kw, alreadyLiked ? -1 : 1);
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
  const alreadyDisliked = profile.dislikedIds.includes(article.id);
  const wasLiked = profile.likedIds.includes(article.id);
  const delta = alreadyDisliked ? 2.5 : wasLiked ? -5.5 : -2.5;
  let keywordWeights = profile.keywordWeights;
  if (wasLiked) {
    for (const kw of article.keywords.slice(0, 6)) {
      keywordWeights = adjustWeight(keywordWeights, kw, -1);
    }
  }

  const topicWeights = adjustWeight(profile.topicWeights, article.category, delta);
  const sourceWeights = adjustWeight(profile.sourceWeights, article.sourceId, delta);

  return {
    ...profile,
    dislikedIds: alreadyDisliked
      ? profile.dislikedIds.filter((id) => id !== article.id)
      : [article.id, ...profile.dislikedIds],
    likedIds: alreadyDisliked
      ? profile.likedIds
      : profile.likedIds.filter((id) => id !== article.id),
    keywordWeights,
    topicWeights,
    sourceWeights,
  };
}

export function toggleArticleBookmark(
  profile: PersonalizationProfile,
  article: NewsArticle
): PersonalizationProfile {
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
  nowMs: number = Date.now()
): ScoredArticle {
  if (profile.dislikedIds.includes(article.id)) {
    return { article, score: -100, reason: 'Weniger davon' };
  }

  const publishedMs = Date.parse(article.publishedAt) || nowMs;
  const ageHours = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60));
  const freshness = 12 * Math.exp(-ageHours / 20);
  const topicScore = Math.max(-3, Math.min(3, profile.topicWeights[article.category] ?? 0));
  const sourceScore = Math.max(-1.5, Math.min(1.5, (profile.sourceWeights[article.sourceId] ?? 0) * 0.5));
  const keywordWeight = article.keywords.reduce((sum, keyword) => sum + (profile.keywordWeights[keyword] ?? 0), 0);
  const keywordScore = Math.max(-1.5, Math.min(1.5, keywordWeight * 0.4));
  const interest = topicScore + sourceScore + keywordScore;
  const breakingBonus = article.isBreaking ? 10 * Math.exp(-ageHours / 12) : 0;
  const totalScore = freshness + breakingBonus
    + interest * Math.exp(-ageHours / 48)
    + (subscribedSourceIds.has(article.sourceId) ? 0.5 : 0)
    - (profile.readIds.includes(article.id) ? 2 : 0);

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
  nowMs: number = Date.now()
): ScoredArticle[] {
  const subscribedIds = new Set(sources.filter((s) => s.subscribed).map((s) => s.id));
  const ranked = articles
    .map((a) => scoreArticle(a, profile, subscribedIds, nowMs))
    .filter((entry) => entry.score > -50)
    .sort((a, b) => b.score - a.score || b.article.publishedAt.localeCompare(a.article.publishedAt)
      || a.article.id.localeCompare(b.article.id));

  return diversifyArticles(ranked);
}

export function diversifyArticles(ranked: ScoredArticle[]): ScoredArticle[] {
  const selected: ScoredArticle[] = [];
  // Mix each page of recommendations. Consider other topics even if one source
  // supplies most of the initial candidates.
  while (ranked.length) {
    const bySource = new Map<string, number>();
    const byTopic = new Map<string, number>();
    const adjustedScore = ({ article, score }: ScoredArticle) =>
      score - 2 * (bySource.get(article.sourceId) ?? 0) - 3 * (byTopic.get(article.category) ?? 0);
    for (let slot = 0; slot < 12 && ranked.length; slot++) {
      let best = 0;
      let bestScore = adjustedScore(ranked[best]);
      for (let i = 1; i < ranked.length && ranked[i].score >= bestScore; i++) {
        const score = adjustedScore(ranked[i]);
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      }
      const [entry] = ranked.splice(best, 1);
      selected.push(entry);
      const { sourceId, category } = entry.article;
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
