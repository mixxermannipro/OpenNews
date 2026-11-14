import { registerPlugin } from '@capacitor/core';

export const NewsWidget = registerPlugin<{ update(options: { stories: { title: string; source: string; category: string }[] }): Promise<void> }>('NewsWidget');
