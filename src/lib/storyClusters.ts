import type { NewsArticle } from '../types/news';

const stopWords = new Set(['aber', 'auch', 'eine', 'einer', 'einen', 'einem', 'nach', 'über', 'unter', 'wird', 'werden', 'sind', 'dass', 'mehr', 'neue', 'neuen', 'sich', 'this', 'that', 'with', 'from', 'after', 'have']);
const maxDistance = 36 * 60 * 60_000;

interface InternalCluster {
  lead: NewsArticle;
  timestamp: number;
  headline: string;
  words: Set<string>;
  reports: NewsArticle[];
}

export function clusterStories(articles: NewsArticle[]) {
  const clusters: InternalCluster[] = [];
  const byHeadline = new Map<string, number[]>();
  const byCategoryWord = new Map<string, Map<string, number[]>>();

  for (const article of articles) {
    const tokens = article.title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const headline = tokens.length >= 2 ? tokens.join(' ') : '';
    const words = new Set(tokens.filter(word => word.length >= 4 && !stopWords.has(word)));
    const timestamp = Date.parse(article.publishedAt);

    let matchIndex = -1;

    if (headline && Number.isFinite(timestamp)) {
      const exactMatches = byHeadline.get(headline);
      if (exactMatches) {
        for (const idx of exactMatches) {
          const cluster = clusters[idx];
          if (Number.isFinite(timestamp - cluster.timestamp) && Math.abs(timestamp - cluster.timestamp) <= maxDistance) {
            matchIndex = idx;
            break;
          }
        }
      }
    }

    if (words.size >= 4 && Number.isFinite(timestamp)) {
      const catIndex = byCategoryWord.get(article.category);
      if (catIndex) {
        const overlaps = new Map<number, number>();
        for (const word of words) {
          const list = catIndex.get(word);
          if (!list) continue;
          for (const idx of list) {
            if (matchIndex >= 0 && idx >= matchIndex) break;
            overlaps.set(idx, (overlaps.get(idx) ?? 0) + 1);
          }
        }
        for (const [idx, overlap] of overlaps) {
          if (overlap < 4 || (matchIndex >= 0 && idx >= matchIndex)) continue;
          const cluster = clusters[idx];
          if (!Number.isFinite(timestamp - cluster.timestamp) || Math.abs(timestamp - cluster.timestamp) > maxDistance) continue;
          if (overlap / Math.max(words.size, cluster.words.size) >= 0.65) {
            matchIndex = idx;
          }
        }
      }
    }

    if (matchIndex >= 0) {
      clusters[matchIndex].reports.push(article);
    } else {
      const idx = clusters.length;
      clusters.push({ lead: article, headline, words, timestamp, reports: [article] });
      if (headline) {
        const list = byHeadline.get(headline);
        if (list) list.push(idx);
        else byHeadline.set(headline, [idx]);
      }
      if (words.size >= 4) {
        let catIndex = byCategoryWord.get(article.category);
        if (!catIndex) {
          catIndex = new Map<string, number[]>();
          byCategoryWord.set(article.category, catIndex);
        }
        for (const word of words) {
          const list = catIndex.get(word);
          if (list) list.push(idx);
          else catIndex.set(word, [idx]);
        }
      }
    }
  }

  return clusters.map(({ lead, reports }) => ({ lead, reports }));
}
