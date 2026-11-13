import { CapacitorHttp } from '@capacitor/core';
import type { NewsArticle, NewsSource } from '../types/news';
import { parseFeedPayload } from './rssParser';

type FeedFormat = 'rss' | 'atom' | 'json';
type DiscoveredFeed = { name: string; url: string; format: FeedFormat };

function publicHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    // Prevent accidentally fetching device-local services from arbitrary saved feeds.
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1' || host === '[::1]') return null;
    if (/^(10|127|192\\.168|169\\.254)\\./.test(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function getNativeText(url: string, timeout = 6500): Promise<string> {
  const response = await CapacitorHttp.get({
    url,
    connectTimeout: timeout,
    readTimeout: timeout,
    responseType: 'text',
    headers: {
      Accept: 'application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml,text/html,*/*',
    },
  });
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

/** RSS requests happen on-device; no external proxy or server is required. */
export async function fetchNativeFeeds(sources: NewsSource[]): Promise<NewsArticle[]> {
  const all: NewsArticle[] = [];
  // Limit concurrent requests, so the app starts reliably on mobile data.
  for (let i = 0; i < Math.min(sources.length, 20); i += 4) {
    const batch = sources.slice(i, i + 4);
    const results = await Promise.all(batch.map(async source => {
      const url = publicHttpUrl(source.url);
      if (!url) return [] as NewsArticle[];
      try {
        const content = await getNativeText(url);
        return parseFeedPayload(content, source);
      } catch {
        // One inaccessible or broken feed must not block the remaining providers.
        return [] as NewsArticle[];
      }
    }));
    for (const articles of results) all.push(...articles);
  }
  return all;
}

/** Discover a site's public RSS/Atom/JSON links without an Express backend. */
export async function discoverNativeFeeds(query: string): Promise<DiscoveredFeed[]> {
  const input = query.trim();
  if (!/^https?:\\/\\//i.test(input) && !/^[a-z0-9.-]+\\.[a-z]{2,}(\\/.*)?$/i.test(input)) return [];
  const url = publicHttpUrl(/^https?:\\/\\//i.test(input) ? input : `https://${input}`);
  if (!url) return [];
  const text = await getNativeText(url);
  const domain = new URL(url).hostname.replace(/^www\\./, '');
  if (/^\\s*<(?:\\?xml|rss|feed)/i.test(text) || /\\\"version\\\"\\s*:\\s*\\\"https?:\\/\\/jsonfeed\\.org/i.test(text)) {
    return [{ name: domain, url, format: /<feed/i.test(text) ? 'atom' : /jsonfeed\\.org/i.test(text) ? 'json' : 'rss' }];
  }
  const document = new DOMParser().parseFromString(text, 'text/html');
  const found: DiscoveredFeed[] = [];
  for (const link of [...document.querySelectorAll('link[rel~="alternate"][href]')]) {
    const type = (link.getAttribute('type') || '').toLowerCase();
    if (!/(rss|atom|xml|feed\\+json|json)/.test(type)) continue;
    const href = link.getAttribute('href');
    if (!href) continue;
    const resolved = publicHttpUrl(new URL(href, url).toString());
    if (!resolved || found.some(item => item.url === resolved)) continue;
    found.push({
      name: link.getAttribute('title') || domain,
      url: resolved,
      format: type.includes('json') ? 'json' : type.includes('atom') ? 'atom' : 'rss',
    });
  }
  return found.slice(0, 6);
}

/** Best-effort HTML article extraction for the native standalone reader. */
export async function extractNativeArticle(url: string): Promise<{ paragraphs: string[]; ogImage?: string }> {
  const target = publicHttpUrl(url);
  if (!target) return { paragraphs: [] };
  const html = await getNativeText(target, 7000);
  const document = new DOMParser().parseFromString(html, 'text/html');
  const scope = document.querySelector('article') || document.querySelector('main') || document.body;
  const paragraphs = [...scope.querySelectorAll('p')]
    .map(p => (p.textContent || '').replace(/\\s+/g, ' ').trim())
    .filter(text => text.length > 45 && !/cookie|datenschutz|newsletter|anzeige|abonnieren/i.test(text))
    .slice(0, 18);
  const ogImageRaw = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const ogImage = ogImageRaw ? new URL(ogImageRaw, target).toString() : undefined;
  return { paragraphs, ogImage };
}
