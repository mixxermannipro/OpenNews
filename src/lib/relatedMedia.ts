import type { NewsArticle } from '../types/news';
import { getArticleMedia, type PlayableMedia } from './articleMedia';

export interface RelatedMediaLink {
  article: NewsArticle;
  media: PlayableMedia;
  score: number;
  sharedTerms: string[];
}

const STOPWORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen', 'und', 'oder', 'aber', 'doch', 'nicht',
  'mit', 'von', 'vom', 'für', 'fuer', 'auf', 'aus', 'bei', 'nach', 'über', 'ueber', 'unter', 'durch',
  'gegen', 'ohne', 'zum', 'zur', 'im', 'in', 'am', 'an', 'als', 'wie', 'was', 'wer', 'wo', 'wann', 'warum',
  'sich', 'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben', 'kann', 'können', 'will', 'soll',
  'muss', 'neue', 'neuen', 'neuer', 'neues', 'mehr', 'sehr', 'auch', 'noch', 'schon', 'jetzt', 'heute',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'about', 'what', 'when',
  'where', 'why', 'how', 'who', 'will', 'have', 'has', 'had', 'are', 'was', 'were', 'been', 'being',
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'par', 'plus', 'mais', 'elle', 'nous', 'vous',
  'los', 'las', 'una', 'para', 'con', 'por', 'sobre', 'como', 'pero', 'más', 'mas', 'entre', 'todo',
  'gli', 'del', 'della', 'delle', 'degli', 'con', 'per', 'sul', 'sulla', 'che', 'come', 'più', 'dopo',
  'com', 'para', 'por', 'uma', 'uns', 'das', 'dos', 'mais', 'como', 'sobre', 'após', 'apos', 'video',
  'shorts', 'podcast', 'news', 'live', 'tagesschau', 'zdfheute', 'bbc', 'guardian', 'spiegel',
]);

function extractTopicTokens(article: Pick<NewsArticle, 'title' | 'summary' | 'keywords'>): Set<string> {
  const raw = `${article.title} ${article.title} ${(article.keywords ?? []).join(' ')} ${(article.summary ?? '').slice(0, 220)}`;
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const tokens = new Set<string>();
  for (const word of normalized.split(/\s+/)) {
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    tokens.add(word);
  }
  return tokens;
}

/**
 * Intelligently links an article to relevant Video, Short/Clip, or Podcast items on the same topic.
 */
export function findRelatedMediaForArticle(
  article: NewsArticle,
  mediaPool: NewsArticle[],
  maxItems = 3,
): RelatedMediaLink[] {
  const targetTokens = extractTopicTokens(article);
  if (targetTokens.size === 0) return [];

  const targetTime = Date.parse(article.publishedAt) || Date.now();
  const seenUrls = new Set<string>();
  const matches: RelatedMediaLink[] = [];

  for (const candidate of mediaPool) {
    if (candidate.id === article.id || candidate.link === article.link) continue;
    const playable = getArticleMedia(candidate)[0];
    if (!playable) continue;
    if (seenUrls.has(playable.url)) continue;

    const candidateTokens = extractTopicTokens(candidate);
    if (candidateTokens.size === 0) continue;

    const shared: string[] = [];
    for (const token of targetTokens) {
      if (candidateTokens.has(token)) {
        shared.push(token);
      } else if (token.length >= 6) {
        const stem = token.slice(0, 6);
        for (const other of candidateTokens) {
          if (other.length >= 6 && other.startsWith(stem)) {
            shared.push(token);
            break;
          }
        }
      }
    }

    if (shared.length < 2) continue;

    const hoursApart = Math.abs(targetTime - (Date.parse(candidate.publishedAt) || targetTime)) / 3_600_000;
    if (hoursApart > 24 * 14) continue;

    const recencyBonus = Math.max(0, 1.5 - hoursApart / 48);
    const categoryBonus = candidate.category === article.category ? 1.2 : 0;
    const score = shared.length * 2.5 + recencyBonus + categoryBonus;

    seenUrls.add(playable.url);
    matches.push({
      article: candidate,
      media: playable,
      score,
      sharedTerms: shared.slice(0, 4),
    });
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}

/**
 * Finds earlier related articles from the local archive to power local "What happened so far" context.
 */
export function findPriorCoverage(
  article: NewsArticle,
  allArticles: NewsArticle[],
  maxItems = 4,
): NewsArticle[] {
  const targetTokens = extractTopicTokens(article);
  if (targetTokens.size === 0) return [];
  const targetTime = Date.parse(article.publishedAt) || Date.now();

  return allArticles
    .filter(other => {
      if (other.id === article.id || other.link === article.link) return false;
      const otherTime = Date.parse(other.publishedAt) || 0;
      return otherTime <= targetTime;
    })
    .map(other => {
      const otherTokens = extractTopicTokens(other);
      let overlap = 0;
      for (const token of targetTokens) {
        if (otherTokens.has(token)) overlap++;
      }
      return { article: other, overlap, time: Date.parse(other.publishedAt) || 0 };
    })
    .filter(item => item.overlap >= 2)
    .sort((a, b) => (b.overlap !== a.overlap ? b.overlap - a.overlap : b.time - a.time))
    .slice(0, maxItems)
    .map(item => item.article);
}
