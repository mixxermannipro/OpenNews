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
}

export const NewsWidget = registerPlugin<{
  update(options: WidgetSnapshot | { stories: { title: string; source: string }[] }): Promise<void>;
  getLaunchArticle(): Promise<WidgetLaunch>;
  addListener(event: 'openStory', listener: (event: WidgetLaunch) => void): Promise<PluginListenerHandle>;
}>('NewsWidget');
