import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { NewsArticle } from '../types/news';
import { publicHttpUrl } from './nativeFeed';
import { parseTranscript } from './transcript';

export async function loadTranscript(transcript: NonNullable<NewsArticle['transcript']>) {
  const url = publicHttpUrl(transcript.url);
  if (!url?.startsWith('https://')) throw new Error('Ungültige Transkript-Adresse.');

  let raw: string;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url, disableRedirects: true, responseType: 'text', connectTimeout: 6000, readTimeout: 6000,
      headers: { Accept: 'text/vtt, text/plain, application/x-subrip' },
    });
    if (response.status !== 200 || typeof response.data !== 'string') throw new Error('Transkript nicht erreichbar.');
    raw = response.data;
  } else {
    const response = await fetch(`/api/media/transcript?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('Transkript nicht erreichbar.');
    raw = await response.text();
  }
  if (raw.length > 512 * 1024) throw new Error('Das Transkript ist zu groß.');
  const text = parseTranscript(raw, transcript.format);
  if (!text) throw new Error('Das Transkript enthält keinen lesbaren Text.');
  return text;
}
