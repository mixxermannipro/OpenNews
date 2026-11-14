export type NewsCategory =
  | 'Alle'
  | 'Für dich'
  | 'Politik'
  | 'Wirtschaft'
  | 'Technologie'
  | 'Wissenschaft'
  | 'Europa'
  | 'Gesellschaft'
  | 'Kultur'
  | 'Sport';

export type FeedFormat = 'rss' | 'atom' | 'json' | 'opendata' | 'podcast';

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  format: FeedFormat;
  category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
  description: string;
  language: 'de' | 'en';
  recommended?: boolean;
  subscribed: boolean;
  accentColor: string;
  shortCode: string;
  isCustom?: boolean;
}

export type FeedResult = { sourceId: string; ok: boolean; count: number };
export type FeedHealth = {
  url: string;
  checkedAt: number;
  lastSuccess?: number;
  consecutiveFailures: number;
  count: number;
  ok: boolean;
};

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'youtube';
  url: string;
  mimeType?: string;
  portrait?: boolean;
}

export interface NewsArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceShortCode: string;
  sourceColor: string;
  title: string;
  summary: string;
  contentHtml?: string;
  paragraphs: string[];
  link: string;
  linkIsFeed?: boolean;
  author?: string;
  category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
  publishedAt: string; // ISO string
  readingTimeMin: number;
  imageUrl?: string;
  media?: MediaAttachment[];
  transcript?: { url: string; format: string };
  videoUrl?: string;
  audioUrl?: string;
  youtubeId?: string;
  keywords: string[];
  isBreaking?: boolean;
}

export interface PersonalizationProfile {
  likedIds: string[];
  dislikedIds: string[];
  bookmarkedIds: string[];
  readIds: string[];
  topicWeights: Record<string, number>;
  sourceWeights: Record<string, number>;
  keywordWeights: Record<string, number>;
  readingSecondsByTopic: Record<string, number>;
  readingSecondsBySource: Record<string, number>;
  totalReadingSeconds: number;
  weightsUpdatedAt?: number;
}

export type AIProviderId = 'google' | 'openai' | 'anthropic' | 'mistral' | 'custom' | 'device';

export type SummaryStyle = 'highlights' | 'five-w' | 'plain' | 'english';

export interface AIProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  autoSummarize: boolean;
  summaryStyle?: SummaryStyle;
}

export interface AISummaryResult {
  bullets: string[];
  mode: 'ai' | 'local';
  providerLabel: string;
  generatedAt: string;
}

export interface FormatPreferences {
  rssAtom: boolean;
  jsonFeed: boolean;
  openData: boolean;
  podcasts: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  breakingOnly: boolean;
  topics: string[];
  from?: string;
  until?: string;
}

export type AppTab = 'home' | 'discover' | 'saved' | 'media' | 'settings' | 'profile';
export type ReaderFontSize = 'normal' | 'large' | 'xlarge';
export type ReaderFontFamily = 'sans' | 'serif';
export type ThemeMode = 'dark' | 'light' | 'system';
