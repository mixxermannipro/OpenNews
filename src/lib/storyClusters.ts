import type { NewsArticle } from '../types/news';

const STOP_WORDS = new Set([
  'aber', 'auch', 'eine', 'einer', 'einen', 'einem', 'eines', 'nach', 'über', 'unter',
  'wird', 'werden', 'wurde', 'wurden', 'sind', 'waren', 'dass', 'mehr', 'neue', 'neuer',
  'neues', 'neuen', 'sich', 'nicht', 'noch', 'schon', 'sehr', 'heute', 'gestern', 'morgen',
  'jahr', 'jahre', 'jahren', 'monat', 'woche', 'tage', 'menschen', 'deutschland', 'berlin',
  'macht', 'zeigt', 'gibt', 'geht', 'kommt', 'will', 'wollen', 'soll', 'sollen', 'kann',
  'können', 'könnte', 'muss', 'müssen', 'wegen', 'gegen', 'durch', 'beim', 'diesem', 'dieser',
  'dieses', 'diese', 'alle', 'alles', 'viele', 'erste', 'ersten', 'weiter', 'wieder', 'immer',
  'doch', 'jetzt', 'laut', 'bericht', 'meldet', 'sagt', 'warnt', 'fordert', 'prüft', 'plant',
  'diskutiert', 'streit', 'debatte', 'warum', 'wieso', 'wie', 'what', 'this', 'that', 'with',
  'from', 'after', 'have', 'will', 'more', 'about', 'into', 'over', 'says', 'amid', 'year',
]);
const SHORT_ENTITIES = new Set([
  'usa', 'ezb', 'spd', 'cdu', 'csu', 'afd', 'fdp', 'who', 'uno', 'fbi', 'cia', 'bmw', 'g7', 'g20', 'co2',
]);
const SAME_CAT_WINDOW = 36 * 60 * 60_000;
const CROSS_CAT_WINDOW = 24 * 60 * 60_000;
const MAX_BUCKET = 48;

interface InternalCluster {
  lead: NewsArticle;
  timestamp: number;
  headline: string;
  words: string[];
  wordSet: Set<string>;
  reports: NewsArticle[];
}

function stemToken(raw: string): string {
  const folded = raw
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
  if (folded.length < 5 || /\d/.test(folded)) return folded;
  const stripped = folded.replace(/(?:ungen|ung|heiten|keiten|ischer|ische|ischen|isches|ern|en|es|te|ten|s|e)$/, '');
  return stripped.length >= 4 ? stripped : folded;
}

function extractTokens(title: string): { headline: string; words: string[]; wordSet: Set<string> } {
  const normalized = title.normalize('NFKC').replace(/(\d)\.(\d{3})\b/g, '$1$2').toLowerCase();
  const rawTokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const headline = rawTokens.length >= 2 ? rawTokens.join(' ') : '';
  const wordSet = new Set<string>();
  for (const token of rawTokens) {
    if (token === 'us') {
      wordSet.add('usa');
      continue;
    }
    if (SHORT_ENTITIES.has(token)) {
      wordSet.add(token);
      continue;
    }
    if (/^\d{2,5}$/.test(token)) {
      if (!/^202\d$/.test(token)) wordSet.add(token);
      continue;
    }
    if (token.length >= 4 && !STOP_WORDS.has(token)) {
      wordSet.add(stemToken(token));
    }
  }
  return { headline, words: [...wordSet], wordSet };
}

function isCompoundMatch(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5 || /\d/.test(a) || /\d/.test(b)) return false;
  if (a.slice(0, 6) === b.slice(0, 6) && Math.min(a.length, b.length) >= 7) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer.length >= 9 && shorter.length >= 5 && longer.includes(shorter);
}

function measureOverlap(aWords: string[], bWords: string[], bSet: Set<string>): { overlap: number; distinctive: number } {
  let overlap = 0;
  let distinctive = 0;
  const usedB = new Set<string>();
  for (const a of aWords) {
    if (bSet.has(a) && !usedB.has(a)) {
      usedB.add(a);
      overlap++;
      if (a.length >= 5 || /^\d{3,}$/.test(a)) distinctive++;
      continue;
    }
    if (a.length < 5) continue;
    for (const b of bWords) {
      if (usedB.has(b)) continue;
      if (isCompoundMatch(a, b)) {
        usedB.add(b);
        overlap++;
        distinctive++;
        break;
      }
    }
  }
  return { overlap, distinctive };
}

function indexKeysFor(words: string[]): string[] {
  const keys: string[] = [];
  for (const word of words) {
    keys.push(word);
    if (word.length >= 9 && !/^\d+$/.test(word)) {
      keys.push(`p:${word.slice(0, 6)}`);
    }
  }
  return keys;
}

export function clusterStories(articles: NewsArticle[]) {
  const clusters: InternalCluster[] = [];
  const byHeadline = new Map<string, number[]>();
  const byToken = new Map<string, number[]>();

  for (const article of articles) {
    const { headline, words, wordSet } = extractTokens(article.title);
    const timestamp = Date.parse(article.publishedAt);

    let matchIndex = -1;

    if (headline && Number.isFinite(timestamp)) {
      const exactMatches = byHeadline.get(headline);
      if (exactMatches) {
        for (const idx of exactMatches) {
          const cluster = clusters[idx];
          if (Number.isFinite(timestamp - cluster.timestamp) && Math.abs(timestamp - cluster.timestamp) <= SAME_CAT_WINDOW) {
            matchIndex = idx;
            break;
          }
        }
      }
    }

    if (matchIndex < 0 && words.length >= 3 && Number.isFinite(timestamp)) {
      const candidates = new Set<number>();
      for (const key of indexKeysFor(words)) {
        const list = byToken.get(key);
        if (!list || list.length > MAX_BUCKET) continue;
        for (const idx of list) candidates.add(idx);
      }

      for (const idx of candidates) {
        if (matchIndex >= 0 && idx >= matchIndex) continue;
        const cluster = clusters[idx];
        if (cluster.words.length < 3) continue;
        const delta = Math.abs(timestamp - cluster.timestamp);
        const sameCategory = cluster.lead.category === article.category;
        if (!Number.isFinite(delta) || delta > (sameCategory ? SAME_CAT_WINDOW : CROSS_CAT_WINDOW)) continue;

        const { overlap, distinctive } = measureOverlap(words, cluster.words, cluster.wordSet);
        if (overlap < 3) continue;
        const minSize = Math.min(words.length, cluster.words.length);
        const maxSize = Math.max(words.length, cluster.words.length);

        const matched = sameCategory
          ? (overlap >= 4 && (overlap / maxSize >= 0.5 || (distinctive >= 2 && overlap / minSize >= 0.55)))
            || (overlap >= 3 && distinctive >= 1 && overlap / minSize >= 0.6 && overlap / maxSize >= 0.35)
          : (overlap >= 4 && distinctive >= 2 && overlap / minSize >= 0.55)
            || (overlap >= 3 && distinctive >= 2 && overlap / minSize >= 0.65 && overlap / maxSize >= 0.4);

        if (matched) {
          matchIndex = idx;
        }
      }
    }

    if (matchIndex >= 0) {
      clusters[matchIndex].reports.push(article);
    } else {
      const idx = clusters.length;
      clusters.push({ lead: article, headline, words, wordSet, timestamp, reports: [article] });
      if (headline) {
        const list = byHeadline.get(headline);
        if (list) list.push(idx);
        else byHeadline.set(headline, [idx]);
      }
      if (words.length >= 3) {
        for (const key of indexKeysFor(words)) {
          const list = byToken.get(key);
          if (list) list.push(idx);
          else byToken.set(key, [idx]);
        }
      }
    }
  }

  return clusters.map(({ lead, reports }) => ({ lead, reports }));
}
