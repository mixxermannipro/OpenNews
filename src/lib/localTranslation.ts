import { registerPlugin } from '@capacitor/core';

const LocalTranslation = registerPlugin<{
  translate(options: { texts: string[] }): Promise<{ texts: string[] }>;
}>('LocalTranslation');

export async function translateToGerman(texts: string[]): Promise<string[]> {
  const result: string[] = [];
  for (let start = 0; start < texts.length; start += 25) {
    const translated = await LocalTranslation.translate({ texts: texts.slice(start, start + 25) });
    result.push(...translated.texts);
  }
  return result;
}
