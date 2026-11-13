import { registerPlugin } from '@capacitor/core';
import type { NotificationSettings } from '../types/news';

export const NewsPush = registerPlugin<{
  configure(options: NotificationSettings & { sources: string[]; prompt: boolean }): Promise<{
    status: 'ready' | 'denied' | 'unconfigured';
  }>;
  test(): Promise<void>;
}>('NewsPush');
