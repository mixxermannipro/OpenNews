import type { AppLanguage, NewsArticle, NewsCategory, NewsSource } from '../types/news';
import { getArticleMedia } from './articleMedia';
import type { StarterPack } from './catalog';
import { isAdvertorial, isPromotionalNoise } from './newsFeed';
import { clusterStories } from './storyClusters';
import { foldSearchText } from './textSearch';

export type DiscoverSort = 'relevance' | 'newest';
export type DiscoverSourceTab = 'discover' | 'international' | 'media';

const CATEGORY_STOP_FOLD = new Set([
  'alle', 'politik', 'wirtschaft', 'technologie', 'wissenschaft', 'europa', 'gesellschaft', 'kultur', 'sport',
  'all', 'politics', 'business', 'economy', 'technology', 'science', 'europe', 'society', 'culture', 'sports',
]);

const ENTITY_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder',
  'aber', 'fuer', 'mit', 'von', 'vom', 'zum', 'zur', 'auf', 'aus', 'bei', 'nach', 'ueber', 'unter',
  'vor', 'seit', 'durch', 'gegen', 'ohne', 'nicht', 'noch', 'auch', 'schon', 'mehr', 'sehr', 'wird',
  'werden', 'wurde', 'wurden', 'sind', 'sein', 'haben', 'hatte', 'kann', 'koennen', 'muss', 'soll',
  'will', 'neue', 'neuer', 'neues', 'neuen', 'erst', 'erste', 'erster', 'heute', 'gestern', 'morgen',
  'jahr', 'jahre', 'jahren', 'zeit', 'ende', 'welt', 'land', 'stadt', 'live', 'news', 'video', 'audio',
  'podcast', 'update', 'ticker', 'analyse', 'kommentar', 'interview', 'report', 'bericht', 'meldung',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'before', 'about',
  'more', 'what', 'when', 'where', 'which', 'their', 'there', 'have', 'been', 'will', 'would', 'could',
  'says', 'said', 'how', 'why', 'who', 'new', 'top', 'best', 'watch', 'read', 'latest', 'today',
  'was', 'wie', 'wer', 'wo', 'wann', 'warum', 'wieso', 'weshalb', 'wenn', 'weil', 'dass', 'doch',
  'denn', 'jetzt', 'immer', 'wieder', 'viele', 'kein', 'keine', 'einige', 'beim', 'ganz', 'etwa',
  'rund', 'laut', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sich', 'ihre', 'seine', 'unser',
  'diese', 'dieser', 'dieses', 'bleibt', 'geht', 'gibt', 'macht', 'steht', 'kommt', 'zeigt',
  'setzt', 'plant', 'warnt', 'fordert', 'bereits', 'jedoch', 'trotz', 'wegen', 'waehrend', 'sowie',
  'also', 'dennoch', 'allerdings', 'sollen', 'wollen', 'muessen', 'worden', 'zwischen', 'hinter',
  'neben', 'dabei', 'damit', 'dazu', 'dafuer', 'dagegen', 'offenbar', 'weiter', 'erneut', 'fast',
  'tagesschau', 'zdfheute', 'deutschlandfunk', 'spiegel', 'zeit', 'sueddeutsche', 'handelsblatt',
  'faz', 'welt', 'ntv', 'heise', 'golem', 'bbc', 'guardian', 'reuters', 'dpa', 'afp', 'apa', 'sda',
]);

const FALLBACK_SUGGESTIONS: Record<AppLanguage, readonly string[]> = {
  de: ['KI', 'Bundestag', 'Klima', 'NASA', 'Energie', 'Startups'],
  en: ['AI', 'Climate', 'NASA', 'Markets', 'Elections', 'Cybersecurity'],
  fr: ['IA', 'Climat', 'NASA', 'Énergie', 'Diplomatie', 'Espace'],
  es: ['IA', 'Clima', 'NASA', 'Energía', 'Mercados', 'Espacio'],
  it: ['IA', 'Clima', 'NASA', 'Energia', 'Mercati', 'Spazio'],
  pt: ['IA', 'Clima', 'NASA', 'Energia', 'Mercados', 'Espaço'],
};

export function normalizeDiscoverText(value: string): string {
  return foldSearchText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Computes non-advertorial article counts per category so the Ressort rail
 * displays accurate tabular numbers.
 */
export function countDiscoverCategories(articles: readonly NewsArticle[]): Record<string, number> {
  const counts: Record<string, number> = { Alle: 0 };
  for (const article of articles) {
    if (isAdvertorial(article)) continue;
    counts.Alle += 1;
    counts[article.category] = (counts[article.category] ?? 0) + 1;
  }
  return counts;
}

/**
 * Curates the Discover editorial feed for a given category:
 * - Excludes advertorials
 * - Deduplicates multi-source story clusters into one best lead
 * - Scores by multi-source signal, freshness, editorial image, and substantive summary
 * - Enforces strict source diversity (max 1 per source in top 5, never 2 consecutive from same source)
 */
export function curateDiscoverFeed(
  articles: readonly NewsArticle[],
  category: NewsCategory = 'Alle',
  nowMs: number = Date.now(),
): NewsArticle[] {
  const scoped = articles.filter(article => {
    if (isAdvertorial(article)) return false;
    return category === 'Alle' || article.category === category;
  });

  if (scoped.length === 0) return [];

  const clusters = clusterStories(scoped);

  const scored = clusters.map(cluster => {
    const lead = cluster.lead;
    const distinctSources = new Set(cluster.reports.map(r => r.sourceId)).size;
    const publishedMs = Date.parse(lead.publishedAt) || 0;
    const ageHours = publishedMs > 0 ? Math.max(0, (nowMs - publishedMs) / 3_600_000) : 48;

    let score = 0;
    // Multi-source editorial importance
    score += Math.min(distinctSources - 1, 4) * 26;
    // Freshness curve
    if (ageHours <= 4) score += 34;
    else if (ageHours <= 12) score += 26;
    else if (ageHours <= 24) score += 18;
    else if (ageHours <= 48) score += 10;
    else score += Math.max(0, 6 - ageHours / 48);

    if (lead.imageUrl) score += 14;
    if (lead.summary && lead.summary.trim().length >= 60) score += 8;
    if (lead.isBreaking) score += 12;
    if (isPromotionalNoise(lead)) score -= 48;

    return { article: lead, score, publishedMs };
  });

  scored.sort((a, b) => b.score - a.score || b.publishedMs - a.publishedMs);

  // Strict source-diversity selection:
  // 1. In the first 5 editorial slots (Hero + Bento + first More), prefer unique sources.
  // 2. Throughout the rest, never put two articles from the same source back-to-back if another is available.
  const remaining = scored.map(item => item.article);
  const result: NewsArticle[] = [];
  const usedInTopFive = new Set<string>();

  while (remaining.length > 0) {
    const slot = result.length;
    const prevSource = slot > 0 ? result[slot - 1].sourceId : null;

    let pickIdx = -1;
    // Slots 0..3 are visual Hero & Bento cards: strongly prefer distinct editorial news sources WITH landscape imagery (avoid vertical Shorts thumbnails with baked-in captions)
    if (slot < 4) {
      pickIdx = remaining.findIndex(
        item =>
          !usedInTopFive.has(item.sourceId) &&
          Boolean(item.imageUrl) &&
          !item.imageUrl!.includes('ytimg.com') &&
          !item.media?.some(m => m.portrait),
      );
    }
    if (pickIdx < 0 && slot < 4) {
      pickIdx = remaining.findIndex(item => !usedInTopFive.has(item.sourceId) && Boolean(item.imageUrl));
    }
    if (pickIdx < 0 && slot < 5) {
      pickIdx = remaining.findIndex(item => !usedInTopFive.has(item.sourceId));
    }
    if (pickIdx < 0 && prevSource) {
      pickIdx = remaining.findIndex(item => item.sourceId !== prevSource);
    }
    if (pickIdx < 0) {
      pickIdx = 0;
    }

    const [picked] = remaining.splice(pickIdx, 1);
    result.push(picked);
    if (slot < 5) usedInTopFive.add(picked.sourceId);
  }

  return result;
}

export interface DiscoverSearchOptions {
  sort?: DiscoverSort;
  category?: NewsCategory;
  mediaOnly?: boolean;
  nowMs?: number;
}

/**
 * Ranked, umlaut- and diacritic-tolerant multi-token AND search across Discover articles.
 */
export function searchDiscoverArticles(
  articles: readonly NewsArticle[],
  query: string,
  options: DiscoverSearchOptions = {},
): NewsArticle[] {
  const normalizedQuery = normalizeDiscoverText(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const { sort = 'relevance', category = 'Alle', mediaOnly = false, nowMs = Date.now() } = options;

  const matched: Array<{ article: NewsArticle; score: number; publishedMs: number }> = [];

  for (const article of articles) {
    if (isAdvertorial(article)) continue;
    if (category !== 'Alle' && article.category !== category) continue;
    if (mediaOnly && getArticleMedia(article).length === 0) continue;

    const titleNorm = normalizeDiscoverText(article.title);
    const summaryNorm = normalizeDiscoverText(article.summary);
    const sourceNorm = normalizeDiscoverText(article.sourceName);
    const categoryNorm = normalizeDiscoverText(article.category);
    const keywordsNorm = normalizeDiscoverText(article.keywords.join(' '));
    const combined = `${titleNorm} ${summaryNorm} ${sourceNorm} ${categoryNorm} ${keywordsNorm}`;

    if (!tokens.every(token => combined.includes(token))) continue;

    let score = 0;
    if (titleNorm.includes(normalizedQuery)) score += 60;
    for (const token of tokens) {
      if (titleNorm.includes(token)) score += 28;
      if (sourceNorm.includes(token)) score += 20;
      if (categoryNorm.includes(token)) score += 14;
      if (keywordsNorm.includes(token)) score += 14;
      if (summaryNorm.includes(token)) score += 8;
    }

    const publishedMs = Date.parse(article.publishedAt) || 0;
    const ageHours = publishedMs > 0 ? Math.max(0, (nowMs - publishedMs) / 3_600_000) : 72;
    score += Math.max(0, 12 - ageHours / 12);
    if (isPromotionalNoise(article)) score -= 25;

    matched.push({ article, score, publishedMs });
  }

  if (sort === 'newest') {
    matched.sort((a, b) => b.publishedMs - a.publishedMs || b.score - a.score);
  } else {
    matched.sort((a, b) => b.score - a.score || b.publishedMs - a.publishedMs);
  }

  return matched.map(item => item.article);
}

/**
 * Extracts dynamic, real-time trending search terms from today's feed without
 * duplicating Ressort category names.
 */
export function extractLiveSearchSuggestions(
  articles: readonly NewsArticle[],
  lang: AppLanguage,
  limit = 6,
): string[] {
  const candidates = new Map<string, { label: string; sources: Set<string>; hits: number }>();

  for (const article of articles.slice(0, 160)) {
    if (isAdvertorial(article)) continue;
    // Extract capitalized terms / acronyms (e.g. "USA", "KI", "Bundestag", "Ukraine", "Nvidia", "EZB")
    const words = article.title.match(/\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9-]{1,22}\b/g) ?? [];
    const seenInArticle = new Set<string>();
    for (const rawWord of words) {
      const clean = rawWord.replace(/^-+|-+$/g, '');
      const folded = normalizeDiscoverText(clean);
      if (!folded || folded.length < 2) continue;
      if (folded.length === 2 && clean !== clean.toUpperCase()) continue;
      if (CATEGORY_STOP_FOLD.has(folded) || ENTITY_STOPWORDS.has(folded)) continue;
      if (/^\d+$/.test(folded)) continue;
      if (seenInArticle.has(folded)) continue;
      seenInArticle.add(folded);

      const entry = candidates.get(folded);
      if (entry) {
        entry.hits += 1;
        entry.sources.add(article.sourceId);
      } else {
        candidates.set(folded, {
          label: clean,
          sources: new Set([article.sourceId]),
          hits: 1,
        });
      }
    }
  }

  const ranked = [...candidates.values()]
    .filter(item => item.sources.size >= 2 || item.hits >= 3)
    .sort((a, b) => b.sources.size - a.sources.size || b.hits - a.hits)
    .map(item => item.label)
    .slice(0, limit);

  if (ranked.length >= 4) return ranked;

  const fallback = FALLBACK_SUGGESTIONS[lang] ?? FALLBACK_SUGGESTIONS.de;
  const seen = new Set(ranked.map(normalizeDiscoverText));
  for (const term of fallback) {
    if (ranked.length >= limit) break;
    const folded = normalizeDiscoverText(term);
    if (!seen.has(folded)) {
      seen.add(folded);
      ranked.push(term);
    }
  }
  return ranked;
}

/**
 * Selects sources for Discover's "Neue Quellen & Perspektiven" section,
 * strongly prioritizing UNSUBSCRIBED sources so users actually discover new voices.
 */
export function selectDiscoverSources(
  sources: readonly NewsSource[],
  lang: AppLanguage,
  tab: DiscoverSourceTab = 'discover',
  category: NewsCategory = 'Alle',
  limit = 8,
): NewsSource[] {
  const pool = sources.filter(source => {
    if (tab === 'media') return source.format === 'podcast';
    if (tab === 'international') return source.format !== 'podcast' && source.language !== lang;
    return source.format !== 'podcast';
  });

  const score = (source: NewsSource): number => {
    let s = 0;
    // Huge priority for unsubscribed sources so Discover doesn't just mirror already-active feeds
    if (!source.subscribed) s += 100;
    if (category !== 'Alle' && source.category === category) s += 45;
    if (tab === 'discover') {
      if (source.language === lang) s += 30;
      else if (source.language === 'en') s += 10;
    } else if (tab === 'international') {
      if (source.language === 'en') s += 20;
      if (source.region === 'EU' || source.region === 'INT' || source.region === 'UK' || source.region === 'US') s += 8;
    } else if (tab === 'media') {
      if (source.language === lang) s += 30;
      else if (source.language === 'en') s += 15;
    }
    if (source.recommended) s += 12;
    return s;
  };

  return [...pool]
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Selects Starter Packs relevant to the user's language, prioritizing packs with unsubscribed sources.
 */
export function selectDiscoverStarterPacks(
  packs: readonly StarterPack[],
  lang: AppLanguage,
  subscribedIds: ReadonlySet<string>,
): Array<StarterPack & { newCount: number }> {
  return packs
    .filter(pack => pack.language === lang || pack.language === 'all')
    .map(pack => ({
      ...pack,
      newCount: pack.sourceIds.filter(id => !subscribedIds.has(id)).length,
    }))
    .sort((a, b) => {
      const aHasNew = a.newCount > 0 ? 1 : 0;
      const bHasNew = b.newCount > 0 ? 1 : 0;
      if (bHasNew !== aHasNew) return bHasNew - aHasNew;
      const aLang = a.language === lang ? 1 : 0;
      const bLang = b.language === lang ? 1 : 0;
      return bLang - aLang;
    });
}
