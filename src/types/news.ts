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

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  mimeType?: string;
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
  author?: string;
  category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
  publishedAt: string; // ISO string
  readingTimeMin: number;
  imageUrl?: string;
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
}

export type AIProviderId = 'google' | 'openai' | 'anthropic' | 'mistral' | 'custom';

export interface AIProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  autoSummarize: boolean;
  includeContext: boolean;
  includePerspectives: boolean;
}

export interface AISummaryResult {
  bullets: string[];
  context: string;
  perspectives: string[];
  criticalQuestions: string[];
  mode: 'ai' | 'local';
  providerLabel: string;
  generatedAt: string;
}

export interface SourceApiKeys {
  guardian?: string;
  nasa?: string;
  youtube?: string;
  bundestag?: string;
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
}

export type AppTab = 'home' | 'discover' | 'saved' | 'search' | 'settings';
export type ReaderFontSize = 'normal' | 'large' | 'xlarge';
export type ReaderFontFamily = 'sans' | 'serif';
export type ThemeMode = 'dark' | 'light' | 'system';
