import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type DailyBriefingSettings = { enabled: boolean; time: string };

export const DailyBriefing = registerPlugin<{
  configure(options: DailyBriefingSettings): Promise<void>;
  updateHeadline(options: { headline: string }): Promise<void>;
  getLaunch(): Promise<{ open: boolean }>;
  addListener(event: 'open', action: () => void): Promise<PluginListenerHandle>;
}>('DailyBriefing');
