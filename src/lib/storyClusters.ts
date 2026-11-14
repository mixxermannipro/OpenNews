import type { NewsArticle } from '../types/news';

const stopWords = new Set(['aber', 'auch', 'eine', 'einer', 'einen', 'einem', 'nach', 'über', 'unter', 'wird', 'werden', 'sind', 'dass', 'mehr', 'neue', 'neuen', 'sich', 'this', 'that', 'with', 'from', 'after', 'have']);
const maxDistance = 36 * 60 * 60_000;

export function clusterStories(articles: NewsArticle[]) {
  const clusters: { lead: NewsArticle; timestamp: number; words: Set<string>; reports: NewsArticle[] }[] = [];
  for (const article of articles) {
    const words = new Set((article.title.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])
      .filter(word => !stopWords.has(word)));
    const timestamp = Date.parse(article.publishedAt);
    const match = words.size >= 4 && clusters.find(cluster => {
      if (cluster.lead.category !== article.category || Math.abs(timestamp - cluster.timestamp) > maxDistance) return false;
      const overlap = [...words].filter(word => cluster.words.has(word)).length;
      return overlap >= 4 && overlap / Math.max(words.size, cluster.words.size) >= 0.65;
    });
    if (match) match.reports.push(article);
    else clusters.push({ lead: article, words, timestamp, reports: [article] });
  }
  return clusters.map(({ lead, reports }) => ({ lead, reports }));
}
