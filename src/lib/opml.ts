import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { publicHttpUrl } from './nativeFeed';
import type { FeedFormat, NewsSource } from '../types/news';

const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!);

export function exportOpml(sources: NewsSource[]): string {
  const outlines = sources.filter(source => source.subscribed).map(source =>
    `    <outline text="${escapeAttribute(source.name)}" type="${source.format}" xmlUrl="${escapeAttribute(source.url)}"/>`
  );
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">', '  <head><title>OpenNews</title></head>', '  <body>', ...outlines, '  </body>', '</opml>'].join('\n');
}

interface Outline { outline?: Outline | Outline[]; '@_xmlUrl'?: string; '@_text'?: string; '@_title'?: string; '@_type'?: string }

export function importOpml(text: string): NewsSource[] {
  if (text.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new Error('Ungültige OPML-Datei.');
  }
  const body = new XMLParser({ ignoreAttributes: false }).parse(text)?.opml?.body as Outline | '' | undefined;
  if (body === undefined) throw new Error('Die Datei enthält keine OPML-Quellenliste.');
  const sources = new Map<string, NewsSource>();
  const queue: Outline[] = body ? [body] : [];
  const formats: FeedFormat[] = ['rss', 'atom', 'json', 'opendata', 'podcast'];
  while (queue.length) {
    const item = queue.pop();
    if (!item || typeof item !== 'object') continue;
    if (item.outline) queue.push(...(Array.isArray(item.outline) ? [...item.outline].reverse() : [item.outline]));
    const url = typeof item['@_xmlUrl'] === 'string' ? publicHttpUrl(item['@_xmlUrl']) : null;
    if (!url || sources.has(url)) continue;
    const name = (item['@_title'] || item['@_text'] || new URL(url).hostname).slice(0, 100);
    const type = item['@_type'] as FeedFormat;
    sources.set(url, {
      id: `opml:${url}`, name, url, format: formats.includes(type) ? type : 'rss',
      category: 'Gesellschaft', description: 'Importierte Quelle', subscribed: true, isCustom: true,
      language: 'de', accentColor: '#52525B', shortCode: name.slice(0, 3).toUpperCase(),
    });
    if (sources.size >= 500) throw new Error('Die OPML-Datei enthält zu viele Quellen.');
  }
  return [...sources.values()];
}
