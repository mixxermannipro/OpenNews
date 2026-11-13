import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NewsArticle } from '../types/news';

const ArticleShare = registerPlugin<{ share(options: { title: string; url: string }): Promise<void> }>('ArticleShare');

export async function shareArticle(article: NewsArticle, url = article.link): Promise<boolean> {
  if (Capacitor.getPlatform() === 'android') {
    await ArticleShare.share({ title: article.title, url });
  } else if (navigator.share) {
    await navigator.share({ title: article.title, text: article.summary, url });
  } else {
    await navigator.clipboard.writeText(url);
    return true;
  }
  return false;
}
