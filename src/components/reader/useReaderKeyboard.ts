import { useEffect } from 'react';
import type { NewsArticle } from '../../types/news';

export function useReaderKeyboard({
  showSummary,
  showTypography,
  setShowTypography,
  previousArticle,
  nextArticle,
  article,
  newspaperMode,
  onOpenArticle,
  onToggleBookmark,
  onToggleQueue,
  onNewspaperMode,
}: {
  showSummary: boolean;
  showTypography: boolean;
  setShowTypography: (value: boolean) => void;
  previousArticle?: NewsArticle;
  nextArticle?: NewsArticle;
  article: NewsArticle;
  newspaperMode: boolean;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleQueue: (article: NewsArticle) => void;
  onNewspaperMode: (value: boolean) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showSummary || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        return;
      }
      if (event.key === 'Escape' && showTypography) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setShowTypography(false);
        return;
      }
      if ((event.key === 'ArrowLeft' || event.key === 'k') && previousArticle) {
        event.preventDefault();
        onOpenArticle(previousArticle);
      } else if ((event.key === 'ArrowRight' || event.key === 'j') && nextArticle) {
        event.preventDefault();
        onOpenArticle(nextArticle);
      } else if (event.key === 'b') {
        event.preventDefault();
        onToggleBookmark(article);
      } else if (event.key === 'q') {
        event.preventDefault();
        onToggleQueue(article);
      } else if (event.key === 'n') {
        event.preventDefault();
        onNewspaperMode(!newspaperMode);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    showSummary,
    showTypography,
    setShowTypography,
    previousArticle,
    nextArticle,
    article,
    newspaperMode,
    onOpenArticle,
    onToggleBookmark,
    onToggleQueue,
    onNewspaperMode,
  ]);
}
