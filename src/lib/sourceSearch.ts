import type { AppLanguage, NewsCategory, NewsSource } from '../types/news';
import { APP_LANGUAGES, translateCategory } from './i18n';

export type SourceTypeFilter = 'all' | 'news' | 'podcast' | 'custom';

export interface SourceSearchFilters {
  query?: string;
  language?: 'all' | AppLanguage;
  category?: 'all' | Exclude<NewsCategory, 'Alle' | 'Für dich'>;
  type?: SourceTypeFilter;
  onlySubscribed?: boolean;
  locale?: string;
}

const LANGUAGE_ALIASES: Record<AppLanguage, string[]> = {
  de: ['de', 'deutsch', 'german', 'allemand', 'aleman', 'tedesco', 'alemao', 'dach'],
  en: ['en', 'english', 'englisch', 'anglais', 'ingles', 'inglese', 'international', 'global'],
  fr: ['fr', 'francais', 'franzosisch', 'french', 'frances', 'francese', 'frankreich', 'france'],
  es: ['es', 'espanol', 'spanisch', 'spanish', 'espagnol', 'spagnolo', 'espanhol', 'spanien', 'spain'],
  it: ['it', 'italiano', 'italienisch', 'italian', 'italien', 'italy', 'italia'],
  pt: ['pt', 'portugues', 'portugiesisch', 'portuguese', 'portugais', 'portoghese', 'brasil', 'brazil', 'portugal'],
};

const REGION_ALIASES: Record<string, string[]> = {
  DE: ['de', 'deutschland', 'germany', 'allemagne', 'alemania', 'germania', 'dach'],
  AT: ['at', 'osterreich', 'austria', 'autriche', 'dach'],
  CH: ['ch', 'schweiz', 'switzerland', 'suisse', 'svizzera', 'suiza', 'dach'],
  UK: ['uk', 'gb', 'grobbritannien', 'grossbritannien', 'britain', 'england', 'london', 'vereinigte konigreich'],
  US: ['us', 'usa', 'amerika', 'america', 'united states', 'vereinigte staaten'],
  FR: ['fr', 'frankreich', 'france', 'francia', 'paris'],
  ES: ['es', 'spanien', 'spain', 'espana', 'espagne', 'spagna', 'madrid'],
  IT: ['it', 'italien', 'italy', 'italia', 'italie', 'rom', 'roma'],
  PT: ['pt', 'portugal', 'lisboa', 'lissabon'],
  BR: ['br', 'brasilien', 'brazil', 'brasil', 'bresil', 'brasile'],
  EU: ['eu', 'europa', 'europe', 'brussel', 'brussels'],
  INT: ['int', 'international', 'welt', 'world', 'global', 'monde', 'mundo'],
};

/**
 * Normalizes text for accent- and umlaut-insensitive search.
 * Maps e.g. "Süddeutsche" -> "suddeutsche" (and expands ä/ö/ü/ß digraph matches).
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

function foldGermanDigraphs(normalized: string): string {
  return normalized
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function categorySearchTerms(category: NewsSource['category']): string {
  return APP_LANGUAGES.map(l => normalizeSearchText(translateCategory(l.code, category))).join(' ');
}

export function scoreSourceMatch(source: NewsSource, rawQuery: string): number {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return 1;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 1;

  const name = normalizeSearchText(source.name);
  const nameFolded = foldGermanDigraphs(name);
  const shortCode = normalizeSearchText(source.shortCode);
  const domain = extractDomain(source.url);
  const description = normalizeSearchText(source.description);
  const descriptionFolded = foldGermanDigraphs(description);
  const categories = categorySearchTerms(source.category);
  const langTerms = (LANGUAGE_ALIASES[source.language] ?? [source.language]).join(' ');
  const regionTerms = source.region ? (REGION_ALIASES[source.region] ?? [source.region.toLowerCase()]).join(' ') : '';
  const tags = source.tags ? normalizeSearchText(source.tags.join(' ')) : '';
  const format = source.format.toLowerCase();

  let totalScore = 0;

  for (const token of tokens) {
    const foldedToken = foldGermanDigraphs(token);
    let tokenScore = 0;

    if (name === token || nameFolded === foldedToken) {
      tokenScore = 120;
    } else if (name.startsWith(token) || nameFolded.startsWith(foldedToken)) {
      tokenScore = 90;
    } else if (name.split(' ').some(word => word.startsWith(token) || foldGermanDigraphs(word).startsWith(foldedToken))) {
      tokenScore = 76;
    } else if (name.includes(token) || nameFolded.includes(foldedToken)) {
      tokenScore = 62;
    } else if (shortCode === token) {
      tokenScore = 60;
    } else if (domain.includes(token)) {
      tokenScore = 54;
    } else if (categories.includes(token) || categories.includes(foldedToken)) {
      tokenScore = 44;
    } else if (langTerms.split(' ').some(w => w === token || w.startsWith(token))) {
      tokenScore = 40;
    } else if (regionTerms && regionTerms.split(' ').some(w => w === token || w.startsWith(token))) {
      tokenScore = 38;
    } else if (tags.includes(token) || tags.includes(foldedToken)) {
      tokenScore = 34;
    } else if (description.includes(token) || descriptionFolded.includes(foldedToken)) {
      tokenScore = 24;
    } else if (format === token || (token === 'video' && (format === 'podcast' || tags.includes('video')))) {
      tokenScore = 20;
    }

    if (tokenScore === 0) return 0;
    totalScore += tokenScore;
  }

  if (source.recommended) totalScore += 6;
  if (source.subscribed) totalScore += 3;
  return totalScore;
}

export function searchAndFilterSources(
  sources: NewsSource[],
  filters: SourceSearchFilters = {},
): NewsSource[] {
  const {
    query = '',
    language = 'all',
    category = 'all',
    type = 'all',
    onlySubscribed = false,
    locale = 'de',
  } = filters;

  const trimmed = query.trim();
  const candidates: Array<{ source: NewsSource; score: number }> = [];

  for (const source of sources) {
    if (onlySubscribed && !source.subscribed) continue;
    if (language !== 'all' && source.language !== language) continue;
    if (category !== 'all' && source.category !== category) continue;
    if (type === 'custom' && !source.isCustom) continue;
    if (type === 'podcast' && source.format !== 'podcast' && !source.tags?.includes('video')) continue;
    if (type === 'news' && source.format === 'podcast') continue;

    const score = trimmed ? scoreSourceMatch(source, trimmed) : 1;
    if (score > 0) {
      candidates.push({ source, score });
    }
  }

  candidates.sort((a, b) => {
    if (trimmed && b.score !== a.score) return b.score - a.score;
    if (!trimmed) {
      if (a.source.subscribed !== b.source.subscribed) return a.source.subscribed ? -1 : 1;
      if (Boolean(a.source.recommended) !== Boolean(b.source.recommended)) {
        return a.source.recommended ? -1 : 1;
      }
    }
    return a.source.name.localeCompare(b.source.name, locale, { sensitivity: 'base', numeric: true });
  });

  return candidates.map(entry => entry.source);
}
