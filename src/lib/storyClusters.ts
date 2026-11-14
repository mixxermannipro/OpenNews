import type { NewsArticle } from '../types/news';

const stopWords = new Set(['aber', 'auch', 'eine', 'einer', 'einen', 'einem', 'nach', 'über', 'unter', 'wird', 'werden', 'sind', 'dass', 'mehr', 'neue', 'neuen', 'sich', 'this', 'that', 'with', 'from', 'after', 'have']);
const maxDistance = 36 * 60 * 60_000;

export function clusterStories(articles: NewsArticle[]) {
  const clusters: { lead: NewsArticle; timestamp: number; headline: string; words: Set<string>; reports: NewsArticle[] }[] = [];
  for (const article of articles) {
    const tokens = article.title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const headline = tokens.length >= 2 ? tokens.join(' ') : '';
    const words = new Set(tokens.filter(word => word.length >= 4 && !stopWords.has(word)));
    const timestamp = Date.parse(article.publishedAt);
    const match = clusters.find(cluster => {
      if (!Number.isFinite(timestamp - cluster.timestamp) || Math.abs(timestamp - cluster.timestamp) > maxDistance) return false;
      if (headline && headline === cluster.headline) return true;
      if (words.size < 4 || cluster.lead.category !== article.category) return false;
      let overlap = 0;
      for (const word of words) if (cluster.words.has(word)) overlap++;
      return overlap >= 4 && overlap / Math.max(words.size, cluster.words.size) >= 0.65;
    });
    if (match) match.reports.push(article);
    else clusters.push({ lead: article, headline, words, timestamp, reports: [article] });
  }
  return clusters.map(({ lead, reports }) => ({ lead, reports }));
}
