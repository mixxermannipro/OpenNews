import type { NewsArticle } from '../types/news';

export const PLAY_BETA = import.meta.env?.VITE_OPENNEWS_PLAY_BETA === '1';

function articleForPlayBeta(article: NewsArticle): NewsArticle {
  const { summary, paragraphs, contentHtml, imageUrl, media, transcript } = article;
  if (!summary && !paragraphs.length && !contentHtml && !imageUrl && !transcript &&
      !media?.some(item => item.type === 'image')) return article;
  return {
    ...article,
    summary: '',
    contentHtml: undefined,
    paragraphs: [],
    imageUrl: undefined,
    media: media?.filter(item => item.type !== 'image'),
    transcript: undefined,
  };
}

export function articlesForBuild(articles: NewsArticle[]): NewsArticle[] {
  return PLAY_BETA ? articles.map(articleForPlayBeta) : articles;
}

export function savedArticlesForBuild(articles: Record<string, NewsArticle>): Record<string, NewsArticle> {
  if (!PLAY_BETA) return articles;
  return Object.fromEntries(Object.entries(articles).map(([id, article]) => [id, articleForPlayBeta(article)]));
}
