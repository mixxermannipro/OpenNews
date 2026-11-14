import { Capacitor, registerPlugin } from '@capacitor/core';

type PromptSession = { prompt(input: string): Promise<string>; destroy(): void };
type BrowserModel = {
  availability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(): Promise<PromptSession>;
};

const android = registerPlugin<{
  availability(): Promise<{ supported: boolean }>;
  summarize(options: { text: string }): Promise<{ summary: string }>;
}>('LocalSummary');

function browserModel() {
  return (globalThis as typeof globalThis & { LanguageModel?: BrowserModel }).LanguageModel;
}

export async function localAIAvailable() {
  try {
    if (Capacitor.getPlatform() === 'android') return (await android.availability()).supported;
    const availability = await browserModel()?.availability();
    return Boolean(availability && availability !== 'unavailable');
  } catch {
    return false;
  }
}

export function createBrowserAISession() {
  const model = browserModel();
  if (!model) throw new Error('Dieses Gerät stellt kein lokales KI-Modell bereit.');
  return model.create();
}

export async function summarizeOnAndroid(text: string) {
  return (await android.summarize({ text })).summary;
}
