import { registerPlugin } from '@capacitor/core';
import type { NotificationSettings } from '../types/news';

export const NewsPush = registerPlugin<{
  configure(options: NotificationSettings & { sources: string[] }): Promise<{
    status: 'ready' | 'denied' | 'unconfigured';
  }>;
  checkAccess(): Promise<{ allowed: boolean }>;
  requestAccess(): Promise<{ allowed: boolean }>;
  openSettings(): Promise<void>;
  test(): Promise<void>;
}>('NewsPush');
