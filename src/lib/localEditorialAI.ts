import type { NewsArticle } from '../types/news';
import { clusterStories } from './storyClusters';

export type EditorialArticleType = 'breaking' | 'opinion' | 'analysis' | 'interview' | 'factcheck' | 'report';

export interface ClickbaitClarification {
  isClickbait: boolean;
  clarifiedLead?: string;
}

export interface TrendingTopicItem {
  id: string;
  lead: NewsArticle;
  reports: NewsArticle[];
  sourceCount: number;
  sources: Array<{ id: string; name: string; shortCode: string; color: string }>;
  category: NewsArticle['category'];
}

const OPINION_PATTERNS = [
  /\b(kommentar|meinung|kolumne|leitartikel|gastbeitrag|glosse|essay|debatte)\b/i,
  /\b(opinion|editorial|column|op-ed|commentary|perspective)\b/i,
  /\b(tribune|édito|éditorial|chronique|point de vue)\b/i,
  /\b(opinión|editorial|columna|tribuna|análisis personal)\b/i,
  /\b(opinione|editoriale|commento|rubrica)\b/i,
  /\b(opinião|crónica|crônica|artigo de opinião)\b/i,
];

const INTERVIEW_PATTERNS = [
  /\b(interview|im gespräch|gespräch mit|fragt nach)\b/i,
  /\b(q&a|in conversation with|speaks to|interview with)\b/i,
  /\b(entretien|interview avec|entrevista|intervista)\b/i,
];

const FACTCHECK_PATTERNS = [
  /\b(faktencheck|faktenfuchs|fact[- ]?check|verifikation|stimmt das|gerücht im check)\b/i,
  /\b(désintox|vérification|verifica|checagem)\b/i,
];

const ANALYSIS_PATTERNS = [
  /\b(analyse|hintergrund|einordnung|erklärt|reportage|dossiers?|tiefenblick|überblick)\b/i,
  /\b(analysis|explainer|explained|deep dive|in depth|background|investigation)\b/i,
  /\b(analyse|décryptage|enquête|análisis|claves|inchiesta|approfondimento|análise)\b/i,
];

const CLICKBAIT_PATTERNS = [
  /\b(du wirst nicht glauben|was dann passiert|darum geht es wirklich|das steckt dahinter|so reagiert|unfassbar|schockierend|unglaublich|wahnsinn|hammer|krass)\b/i,
  /\b(you won'?t believe|what happened next|here'?s why|this is why|the real reason|mind[- ]?blowing|shocking truth|number \d+ will)\b/i,
  /\b(vous n'allez pas croire|la vraie raison|ce qui s'est passé ensuite|incroyable)\b/i,
  /\b(no vas a creer|lo que pasó después|la verdadera razón|increíble)\b/i,
  /\b(non crederai|ecco perché|cosa è successo dopo|incredibile)\b/i,
  /\b(você não vai acreditar|veja o que aconteceu|o verdadeiro motivo)\b/i,
  /[!?]{2,}/,
  /^(warum|darum|deshalb|so|was|wie)\s+.{12,}[?!]$/i,
];

/**
 * Classifies an article into an editorial type using purely local multilingual cues.
 */
export function classifyArticleType(article: Pick<NewsArticle, 'title' | 'summary' | 'link' | 'isBreaking'>): EditorialArticleType {
  if (article.isBreaking) return 'breaking';
  const headlineAndUrl = `${article.title} ${article.link}`;

  if (FACTCHECK_PATTERNS.some(rx => rx.test(headlineAndUrl))) return 'factcheck';
  if (INTERVIEW_PATTERNS.some(rx => rx.test(headlineAndUrl))) return 'interview';
  if (OPINION_PATTERNS.some(rx => rx.test(headlineAndUrl))) return 'opinion';
  if (ANALYSIS_PATTERNS.some(rx => rx.test(headlineAndUrl))) return 'analysis';

  return 'report';
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜÉÈÊÀÂÍÓÚÇ0-9„"«])/)
    .map(s => s.trim())
    .filter(s => s.length >= 24);
}

/**
 * Detects sensational/vague clickbait titles and extracts a calm factual lead sentence locally.
 */
export function detectAndClarifyClickbait(
  article: Pick<NewsArticle, 'title' | 'summary' | 'paragraphs'>,
): ClickbaitClarification {
  const title = article.title.trim();
  if (!title) return { isClickbait: false };

  const uppercaseWords = title.split(/\s+/).filter(w => w.length >= 4 && w === w.toUpperCase() && /[A-ZÄÖÜ]/.test(w));
  const looksClickbaity =
    uppercaseWords.length >= 2 ||
    CLICKBAIT_PATTERNS.some(rx => rx.test(title));

  if (!looksClickbaity) return { isClickbait: false };

  const candidatePool = [article.summary, ...(article.paragraphs ?? []).slice(0, 3)]
    .filter(Boolean)
    .join(' ');
  const sentences = splitSentences(candidatePool);

  const normalizedTitle = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const factual = sentences.find(sentence => {
    const norm = sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!norm || norm === normalizedTitle) return false;
    if (norm.startsWith(normalizedTitle.slice(0, Math.min(28, normalizedTitle.length)))) return false;
    if (/[!?]{2,}/.test(sentence)) return false;
    return sentence.length >= 30 && sentence.length <= 220;
  });

  return {
    isClickbait: true,
    clarifiedLead: factual ? (factual.length > 165 ? `${factual.slice(0, 162).trim()}…` : factual) : undefined,
  };
}

/**
 * Computes live trending multi-source stories purely on-device from the active feed articles.
 */
export function buildTrendingTopics(articles: NewsArticle[], maxTopics = 6): TrendingTopicItem[] {
  if (articles.length < 2) return [];
  const clusters = clusterStories(articles);

  const ranked = clusters
    .map(cluster => {
      const seenSources = new Map<string, { id: string; name: string; shortCode: string; color: string }>();
      for (const report of cluster.reports) {
        if (!seenSources.has(report.sourceId)) {
          seenSources.set(report.sourceId, {
            id: report.sourceId,
            name: report.sourceName,
            shortCode: report.sourceShortCode,
            color: report.sourceColor,
          });
        }
      }
      const newestMs = Math.max(...cluster.reports.map(r => Date.parse(r.publishedAt) || 0));
      return {
        id: cluster.lead.id,
        lead: cluster.lead,
        reports: cluster.reports,
        sourceCount: seenSources.size,
        sources: [...seenSources.values()],
        category: cluster.lead.category,
        newestMs,
      };
    })
    .filter(item => item.sourceCount >= 2)
    .sort((a, b) => {
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
      if (b.reports.length !== a.reports.length) return b.reports.length - a.reports.length;
      return b.newestMs - a.newestMs;
    });

  return ranked.slice(0, maxTopics).map(({ newestMs: _newestMs, ...rest }) => rest);
}
