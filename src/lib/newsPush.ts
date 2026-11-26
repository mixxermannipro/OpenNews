import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NewsArticle, NotificationSettings } from '../types/news';

export interface NotificationFeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  accentColor: string;
  shortCode: string;
}

export interface NotificationLaunchEvent {
  article?: Partial<NewsArticle>;
  pendingSaves?: Array<Partial<NewsArticle>>;
}

export const NewsPush = registerPlugin<{
  configure(
    options: NotificationSettings & {
      sources: string[];
      feeds?: NotificationFeedSource[];
      mutedKeywords?: string[];
    },
  ): Promise<{
    status: 'ready' | 'denied' | 'unconfigured';
    mode?: 'local' | 'fcm+local';
    lastCheckedAt?: number;
  }>;
  checkAccess(): Promise<{ allowed: boolean }>;
  requestAccess(): Promise<{ allowed: boolean }>;
  openSettings(): Promise<void>;
  getLaunchNotification(): Promise<NotificationLaunchEvent>;
  addListener(
    event: 'openNotification',
    listener: (data: NotificationLaunchEvent) => void,
  ): Promise<PluginListenerHandle>;
  test(): Promise<void>;
}>('NewsPush');
