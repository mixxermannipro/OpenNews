import { CapacitorHttp } from '@capacitor/core';
import type { NewsArticle, NewsSource } from '../types/news';
import { parseFeedPayload } from './rssParser';

type FeedFormat = 'rss' | 'atom' | 'json';
type DiscoveredFeed = { name: string; url: string; format: FeedFormat };

export function publicHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return null;
    // Prevent accidentally fetching device-local services from arbitrary saved feeds.
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1' || host === '[::1]') return null;
    if (/^(10|127|192\.168|169\.254)\./.test(host)) return null;
    url.hash = '';
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
export async function fetchNativeFeeds(
  sources: NewsSource[],
  onArticles: (articles: NewsArticle[]) => void,
  signal: AbortSignal,
  loadText = getNativeText,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (!signal.aborted && next < sources.length) {
      const source = sources[next++];
      const url = publicHttpUrl(source.url);
      if (!url) continue;
      try {
        const content = await loadText(url);
        if (signal.aborted || content.length > 4_000_000) continue;
        const articles = parseFeedPayload(content, source);
        if (articles.length) onArticles(articles);
      } catch {
        // Keep cached articles if this provider fails.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, sources.length) }, worker));
}

/** Discover a site's public RSS/Atom/JSON links without an Express backend. */
export async function discoverNativeFeeds(query: string): Promise<DiscoveredFeed[]> {
  const input = query.trim();
  if (!/^https?:\/\//i.test(input) && !/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) return [];
  const url = publicHttpUrl(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (!url) return [];
  const text = await getNativeText(url);
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const xml = text.trimStart().replace(/^<\?xml[^?]*\?>\s*/i, '');
  const format: FeedFormat | undefined = /^<feed[\s>]/i.test(xml) ? 'atom'
    : /^<(rss|rdf:RDF)[\s>]/i.test(xml) ? 'rss'
    : /"version"\s*:\s*"https?:\/\/jsonfeed\.org\//i.test(xml) && xml.startsWith('{') ? 'json'
    : undefined;
  if (format) return [{ name: domain, url, format }];
  const document = new DOMParser().parseFromString(text, 'text/html');
  const found: DiscoveredFeed[] = [];
  for (const link of [...document.querySelectorAll('link[rel~="alternate"][href]')]) {
    const type = (link.getAttribute('type') || '').toLowerCase();
    if (!/(rss|atom|xml|feed\+json|json)/.test(type)) continue;
    const href = link.getAttribute('href');
    if (!href) continue;
    let resolved: string | null;
    try {
      resolved = publicHttpUrl(new URL(href, url).toString());
    } catch {
      continue;
    }
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
export async function extractNativeArticle(url: string): Promise<{ paragraphs: string[]; headingIndexes?: number[]; ogImage?: string }> {
  const target = publicHttpUrl(url);
  if (!target) return { paragraphs: [] };
  const html = await getNativeText(target, 7000);
  if (html.length > 4_000_000) return { paragraphs: [] };
  const { extractArticle } = await import('./articleExtraction');
  return extractArticle(new DOMParser().parseFromString(html, 'text/html'), target);
}
