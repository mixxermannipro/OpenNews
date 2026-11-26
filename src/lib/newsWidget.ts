import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NewsArticle } from '../types/news';

type WidgetArticle = NewsArticle & { widgetSaved?: boolean };

export interface WidgetFeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  accentColor: string;
  shortCode: string;
}

export interface WidgetSnapshot {
  today: WidgetArticle[];
  personal: WidgetArticle[];
  latest: WidgetArticle[];
  language?: string;
  theme?: 'system' | 'light' | 'dark';
  feeds?: WidgetFeedSource[];
  mutedKeywords?: string[];
}

export interface WidgetLaunch {
  article?: NewsArticle;
  refresh?: boolean;
  discover?: boolean;
  save?: boolean;
  section?: string;
}

export const NewsWidget = registerPlugin<{
  update(options: WidgetSnapshot): Promise<void>;
  getLaunchArticle(): Promise<WidgetLaunch>;
  addListener(event: 'openStory', listener: (event: WidgetLaunch) => void): Promise<PluginListenerHandle>;
}>('NewsWidget');
