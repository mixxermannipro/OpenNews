import { registerPlugin } from '@capacitor/core';

export const NewsWidget = registerPlugin<{ update(options: { headlines: string[] }): Promise<void> }>('NewsWidget');
