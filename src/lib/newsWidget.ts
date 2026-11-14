import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NewsArticle } from '../types/news';

export interface WidgetSnapshot {
  today: NewsArticle[];
  personal: NewsArticle[];
  latest: NewsArticle[];
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
