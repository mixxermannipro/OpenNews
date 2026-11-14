import type { NewsArticle } from '../types/news';
import type { HomeStory } from './newsFeed';

/** Select card sizes without changing feed order. */
export function featuredStoryIds(
  stories: readonly Pick<HomeStory, 'lead' | 'reports'>[],
  { featureLead = false, ranked = true } = {},
): Set<NewsArticle['id']> {
  const featured = new Set<NewsArticle['id']>();
  let lastFeatureAt = -4;
  stories.forEach(({ lead, reports }, index) => {
    if (index === 0 && featureLead) {
      featured.add(lead.id);
      lastFeatureAt = index;
      return;
    }
    if (index - lastFeatureAt < 4) return;
    const multipleSources = reports.some(report => report.sourceId !== lead.sourceId);
    const prominentWithImage = ranked && index < 5 && Boolean(lead.imageUrl);
    if (lead.isBreaking || multipleSources || prominentWithImage) {
      featured.add(lead.id);
      lastFeatureAt = index;
    }
  });
  return featured;
}
