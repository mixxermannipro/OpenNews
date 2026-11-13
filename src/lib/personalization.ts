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
  const delta = alreadyLiked ? -3 : 3;

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
  const delta = alreadyDisliked ? 2.5 : -2.5;

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
  let keywordWeights = { ...profile.keywordWeights };
  for (const kw of article.keywords.slice(0, 4)) {
    keywordWeights = adjustWeight(keywordWeights, kw, 0.4);
  }
  return {
    ...profile,
    readIds: [article.id, ...profile.readIds].slice(0, 200),
    topicWeights: adjustWeight(profile.topicWeights, article.category, 0.8),
    sourceWeights: adjustWeight(profile.sourceWeights, article.sourceId, 0.6),
    keywordWeights,
  };
}

export function recordReadingDuration(
  profile: PersonalizationProfile,
  article: NewsArticle,
  seconds: number
): PersonalizationProfile {
  const clamped = Math.max(0, Math.min(600, Math.round(seconds)));
  if (clamped < 3) return profile;

  // Reading time boosts topic and source affinity (capped per session to avoid skew)
  const weightDelta = Math.min(3.5, clamped / 20);
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
  // Freshness score from 10 down to 0 over ~36h
  const freshness = 10 * Math.exp(-ageHours / 18);

  const topicScore = (profile.topicWeights[article.category] ?? 0) * 1.4;
  const sourceScore = (profile.sourceWeights[article.sourceId] ?? 0) * 1.3;
  const subscribedBoost = subscribedSourceIds.has(article.sourceId) ? 2.5 : -2;

  let keywordScore = 0;
  for (const kw of article.keywords) {
    keywordScore += (profile.keywordWeights[kw] ?? 0) * 0.8;
  }
  keywordScore = Math.min(8, keywordScore);

  const mediaBonus = article.imageUrl ? 1.2 : 0;
  const unreadBonus = profile.readIds.includes(article.id) ? -1.5 : 0.8;
  const breakingBonus = article.isBreaking ? 2.0 : 0;

  const topicReadSecs = profile.readingSecondsByTopic?.[article.category] ?? 0;
  const sourceReadSecs = profile.readingSecondsBySource?.[article.sourceId] ?? 0;
  const readingAffinity = Math.min(5, topicReadSecs / 30) + Math.min(4, sourceReadSecs / 35);

  const totalScore =
    freshness +
    topicScore +
    sourceScore +
    subscribedBoost +
    keywordScore +
    readingAffinity +
    mediaBonus +
    unreadBonus +
    breakingBonus;

  let reason: string | undefined;
  if (topicScore >= 3 || topicReadSecs >= 45) {
    reason = `Weil du ${article.category} magst`;
  } else if (sourceScore >= 2.5 || sourceReadSecs >= 45) {
    reason = `Oft gelesen von ${article.sourceName}`;
  } else if (keywordScore >= 2) {
    reason = 'Passt zu deinen Interessen';
  } else if (article.isBreaking) {
    reason = 'Top-Thema';
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
  return articles
    .map((a) => scoreArticle(a, profile, subscribedIds, nowMs))
    .filter((entry) => entry.score > -50)
    .sort((a, b) => b.score - a.score);
}

export function generateLocalExtractiveSummary(article: NewsArticle): AISummaryResult {
  const fullText = article.paragraphs.join(' ') || article.summary;
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28);

  const bullets =
    sentences.length >= 2
      ? sentences.slice(0, 3)
      : [
          article.summary,
          `Quelle: ${article.sourceName} in der Rubrik ${article.category}.`,
          `Geschätzte Lesezeit: ${article.readingTimeMin} Min.`,
        ];

  const topKeywords = article.keywords.slice(0, 4).join(', ');
  const context = topKeywords
    ? `Dieser Beitrag von ${article.sourceName} ordnet aktuelle Entwicklungen im Bereich ${article.category} ein (Schwerpunkte: ${topKeywords}).`
    : `Aktuelle Meldung aus der Rubrik ${article.category} von ${article.sourceName}.`;

  return {
    bullets,
    context,
    perspectives: [
      `Primäre Einordnung durch ${article.sourceName} mit Fokus auf ${article.category}.`,
      'Für tiefere Analyse, Pro-&-Contra-Abwägung und Faktencheck kannst du in den Einstellungen deinen eigenen KI-Anbieter (Google AI Studio, OpenAI, Claude) hinterlegen.',
    ],
    criticalQuestions: [
      'Welche Primärquellen oder Daten liegen dieser Berichterstattung zugrunde?',
      'Welche mittel- und langfristigen Auswirkungen ergeben sich daraus?',
    ],
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
