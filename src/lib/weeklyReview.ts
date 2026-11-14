import type { NewsArticle, PersonalizationProfile } from '../types/news';
import { distinctArticles } from './newsFeed';

const week = 7 * 86_400_000;

export function reviewWeek(now: Date) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return [monday.getFullYear(), monday.getMonth() + 1, monday.getDate()].join('-');
}

export function selectWeeklyArticles(
  articles: NewsArticle[], profile: Pick<PersonalizationProfile, 'bookmarkedIds' | 'likedIds'>, now: number,
) {
  const liked = new Set(profile.likedIds);
  const saved = new Set(profile.bookmarkedIds);
  return distinctArticles(articles.filter(article => {
    const published = Date.parse(article.publishedAt);
    return published <= now && published > now - week && (liked.has(article.id) || saved.has(article.id));
  }).sort((a, b) => Number(liked.has(b.id)) - Number(liked.has(a.id)) ||
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt))).slice(0, 8);
}
