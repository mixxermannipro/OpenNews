import { exportOpml, importOpml } from './opml';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';

const limit = 5_000_000;
const reactionKeys = ['likedIds', 'dislikedIds', 'bookmarkedIds'] as const;
type Reactions = Pick<PersonalizationProfile, (typeof reactionKeys)[number]>;

export function createDeviceBackup(sources: NewsSource[], profile: PersonalizationProfile, saved: Record<string, NewsArticle>) {
  const bookmarkedSet = new Set(profile.bookmarkedIds);
  return JSON.stringify({
    version: 1,
    sources: exportOpml(sources.filter(source => source.subscribed)),
    reactions: Object.fromEntries(reactionKeys.map(key => [key, profile[key]])),
    bookmarks: Object.values(saved).filter(article => bookmarkedSet.has(article.id)).map(article => ({
      id: article.id, title: article.title, link: article.link, sourceName: article.sourceName, publishedAt: article.publishedAt,
    })),
  }, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseDeviceBackup(text: string): { sources: NewsSource[]; reactions: Reactions; bookmarks: NewsArticle[] } {
  if (text.length > limit) throw new Error('Sicherung ist größer als 5 MB.');
  const data: unknown = JSON.parse(text);
  if (!isObject(data) || data.version !== 1 || typeof data.sources !== 'string' || !isObject(data.reactions) || !Array.isArray(data.bookmarks)) {
    throw new Error('Unbekanntes Sicherungsformat.');
  }
  const reactions = {} as Reactions;
  for (const key of reactionKeys) {
    const list = data.reactions[key];
    if (!Array.isArray(list) || !list.every(id => typeof id === 'string' && id.length <= 1000)) {
      throw new Error('Ungültige Reaktionen.');
    }
    reactions[key] = [...new Set(list)];
  }
  const bookmarks = data.bookmarks.map((item): NewsArticle => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.link !== 'string' || typeof item.title !== 'string' || typeof item.sourceName !== 'string' || !isHttpUrl(item.link)) {
      throw new Error('Ungültige Lesezeichen.');
    }
    return {
      id: item.id, link: item.link, title: item.title, sourceName: item.sourceName,
      sourceId: '', sourceShortCode: '', sourceColor: '#475569', category: 'Gesellschaft',
      summary: '', paragraphs: [], keywords: [], publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : new Date(0).toISOString(), readingTimeMin: 1,
    };
  });
  return { sources: importOpml(data.sources), reactions, bookmarks };
}
