import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NewsArticle } from '../types/news';

export interface WidgetSnapshot {
  today: NewsArticle[];
  personal: NewsArticle[];
  latest: NewsArticle[];
}

export const NewsWidget = registerPlugin<{
  update(options: WidgetSnapshot): Promise<void>;
  getLaunchArticle(): Promise<{ article?: NewsArticle; refresh?: boolean }>;
  addListener(event: 'openStory', listener: (event: { article?: NewsArticle; refresh?: boolean }) => void): Promise<PluginListenerHandle>;
}>('NewsWidget');
