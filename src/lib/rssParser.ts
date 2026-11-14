import { transcriptFormat } from './transcript';
import { XMLParser } from 'fast-xml-parser';
import { deduplicateAttachments } from './articleMedia';
import { extractYouTubeId } from './contentIdentity';
import type { MediaAttachment, NewsArticle, NewsCategory, NewsSource } from '../types/news';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
});

const STOP_WORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'eines', 'und', 'oder', 'aber',
  'mit', 'von', 'für', 'auf', 'ist', 'sind', 'war', 'wird', 'werden', 'hat',
  'haben', 'nach', 'über', 'unter', 'bei', 'aus', 'zum', 'zur', 'dem', 'den',
  'des', 'sich', 'nicht', 'auch', 'noch', 'wie', 'was', 'wer', 'wir', 'ihr',
  'sie', 'man', 'als', 'dass', 'mehr', 'neue', 'neuer', 'neues', 'vor', 'durch',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
  'has', 'have', 'into', 'over', 'after', 'about', 'will', 'new', 'more',
]);

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+|x[\da-f]+);/gi, (entity, digits: string) => {
      const point = /^x/i.test(digits) ? Number.parseInt(digits.slice(1), 16) : Number(digits);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : entity;
    });
}

export function stripHtml(html: string): string {
  if (!html) return '';
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractParagraphs(htmlOrText: string, fallbackSummary: string): string[] {
  const clean = stripHtml(htmlOrText);
  const parts = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 24);
  if (parts.length > 0) return parts.slice(0, 24);
  if (fallbackSummary.trim().length > 0) return [fallbackSummary.trim()];
  return [];
}

export function extractFirstImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1] && /^https?:\/\//i.test(match[1])) {
    return decodeHtmlEntities(match[1]);
  }
  return undefined;
}

export function extractKeywords(title: string, summary: string): string[] {
  const words = `${title} ${summary}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      result.push(w);
      if (result.length >= 10) break;
    }
  }
  return result;
}

export function inferCategory(
  rawCategory: unknown,
  title: string,
  summary: string,
  fallback: Exclude<NewsCategory, 'Alle' | 'Für dich'>
): Exclude<NewsCategory, 'Alle' | 'Für dich'> {
  const raw = Array.isArray(rawCategory)
    ? rawCategory.map((c) => (typeof c === 'string' ? c : c?.['#text'] || c?.['@_term'] || '')).join(' ')
    : typeof rawCategory === 'object' && rawCategory !== null
      ? String((rawCategory as Record<string, unknown>)['#text'] || (rawCategory as Record<string, unknown>)['@_term'] || '')
      : String(rawCategory || '');
  const hay = `${raw} ${title} ${summary}`.toLowerCase();

  if (/\b(politik|bundestag|regierung|kanzler|wahl|partei|diplomatie|nato|ukraine|gaza|minister)\b/.test(hay)) {
    return 'Politik';
  }
  if (/\b(europa|eu-|europäisch|brüssel|ezb|eurozone|strasbourg)\b/.test(hay)) {
    return 'Europa';
  }
  if (/\b(wirtschaft|börse|dax|inflation|aktien|konjunktur|unternehmen|handel|zinsen|bank|euro)\b/.test(hay)) {
    return 'Wirtschaft';
  }
  if (/\b(ki|künstliche intelligenz|ai|software|chip|hardware|apple|google|linux|cyber|tech|digital|robot)\b/.test(hay)) {
    return 'Technologie';
  }
  if (/\b(wissenschaft|forschung|studie|nasa|weltraum|planet|klima|energie|physik|medizin|biotech)\b/.test(hay)) {
    return 'Wissenschaft';
  }
  if (/\b(kultur|film|musik|buch|kunst|theater|museum)\b/.test(hay)) {
    return 'Kultur';
  }
  if (/\b(sport|bundesliga|fußball|olympia|champions|formel 1|tennis)\b/.test(hay)) {
    return 'Sport';
  }
  return fallback;
}

export function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(18, Math.round(words / 180) || 2));
}

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getText(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj['#text'] !== undefined) return String(obj['#text']);
    if (obj['@_href'] !== undefined) return String(obj['@_href']);
  }
  return '';
}

function records(value: unknown): Record<string, unknown>[] {
  return asArray(value).filter(
    (record): record is Record<string, unknown> => typeof record === 'object' && record !== null,
  );
}

function pickImageUrl(item: Record<string, unknown>, rawHtml: string): string | undefined {
  for (const media of asArray(item['media:content'] as Record<string, unknown> | Record<string, unknown>[])) {
    const url = media?.['@_url'];
    const medium = media?.['@_medium'];
    const mime = String(media?.['@_type'] || '').toLowerCase();
    if (typeof url === 'string' && (medium === 'image' || mime.startsWith('image/'))) return url;
  }
  const group = item['media:group'] as Record<string, unknown> | undefined;
  const mediaThumbs = [...records(item['media:thumbnail']), ...records(group?.['media:thumbnail'])];
  for (const t of mediaThumbs) {
    const url = t?.['@_url'] as string | undefined;
    if (url) return url;
  }
  const enclosures = asArray(item['enclosure'] as Record<string, unknown> | Record<string, unknown>[]);
  for (const enc of enclosures) {
    const url = enc?.['@_url'] as string | undefined;
    const type = String(enc?.['@_type'] || '');
    if (url && type.startsWith('image/')) return url;
  }
  const itunesImage = item['itunes:image'] as Record<string, unknown> | undefined;
  if (itunesImage?.['@_href']) return String(itunesImage['@_href']);

  return extractFirstImageFromHtml(rawHtml);
}

function mediaUrl(value: unknown, base?: string): URL | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(decodeHtmlEntities(value).trim(), base);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) return url;
  } catch {
    return undefined;
  }
}

function collectMedia(
  item: Record<string, unknown>,
  link: string,
  feedUrl: string,
  html: string,
  htmlSummary: string,
  imageUrl?: string,
  attachments: unknown[] = [],
) {
  const base = mediaUrl(link, feedUrl)?.href || feedUrl;
  const media = new Map<string, MediaAttachment>();

  function add(value: unknown, rawMime?: unknown, medium?: unknown, portrait = false) {
    const url = mediaUrl(value, base);
    if (!url) return;
    const youtubeId = extractYouTubeId(url.href);
    if (youtubeId) {
      const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}`;
      const isShort = url.pathname.startsWith('/shorts/') || media.get(embedUrl)?.portrait;
      media.set(embedUrl, { type: 'youtube', url: embedUrl, ...(isShort && { portrait: true }) });
      return;
    }
    if (medium === 'embed') return;

    const mimeType = typeof rawMime === 'string' ? rawMime.toLowerCase().split(';')[0].trim() : undefined;
    const mimeCategory = mimeType?.split('/')[0];
    let type: MediaAttachment['type'] | undefined;
    if (mimeCategory === 'audio' || mimeCategory === 'video' || mimeCategory === 'image') type = mimeCategory;
    else if (medium === 'audio' || medium === 'video' || medium === 'image') type = medium;
    else if (/\.(mp3|m4a|ogg|oga|opus|aac|wav|flac)$/i.test(url.pathname)) type = 'audio';
    else if (/\.(mp4|m4v|webm|ogv|mov|m3u8)$/i.test(url.pathname) || mimeType === 'application/vnd.apple.mpegurl') type = 'video';
    else if (/\.(jpe?g|png|gif|webp|avif)$/i.test(url.pathname)) type = 'image';

    if (type && (!media.has(url.href) || (type === 'video' && portrait))) {
      media.set(url.href, { type, url: url.href, mimeType, ...(type === 'video' && portrait && { portrait: true }) });
    }
  }

  for (const enclosure of records(item.enclosure)) add(enclosure['@_url'], enclosure['@_type']);
  for (const enclosure of records(item.link)) {
    if (enclosure['@_rel'] === 'enclosure') add(enclosure['@_href'], enclosure['@_type']);
  }
  for (const attachment of records(attachments)) add(attachment.url, attachment.mime_type);

  for (const group of [item, ...records(item['media:group'])]) {
    for (const entry of records(group['media:content'])) {
      const width = Number(entry['@_width']);
      const height = Number(entry['@_height']);
      add(entry['@_url'], entry['@_type'], entry['@_medium'], width > 0 && height > width);
    }
    for (const player of records(group['media:player'])) add(player['@_url'], undefined, 'embed');
  }
  const atomContent = records(item.content)[0];
  if (atomContent) add(atomContent['@_src'], atomContent['@_type']);
  add(imageUrl, undefined, 'image');
  add(link, undefined, 'embed');

  for (const markup of new Set([html, htmlSummary])) {
    const cleaned = markup.replace(/<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    let parent: 'audio' | 'video' | undefined;
    for (const tag of cleaned.matchAll(/<(\/?)(audio|video|img|source|iframe)\b((?:"[^"]*"|'[^']*'|[^"'<>])*)>/gi)) {
      const name = tag[2].toLowerCase();
      if (name === 'audio' || name === 'video') parent = tag[1] ? undefined : name;
      if (tag[1]) continue;
      const attributes = new Map(
        [...tag[3].matchAll(/([^\s=/"'<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)]
          .map((attribute) => [attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4]]),
      );
      if (name === 'source' && !parent) continue;
      const medium = name === 'img' ? 'image' : name === 'iframe' ? 'embed' : parent;
      add(attributes.get('src'), attributes.get('type'), medium);
    }
  }

  const transcript = [...records(item['podcast:transcript']), ...records(item['media:subTitle'])]
    .flatMap(entry => {
      const url = mediaUrl(entry['@_url'] ?? entry['@_href'], base);
      if (!url || url.protocol !== 'https:') return [];
      const format = transcriptFormat(entry['@_type'], url.href);
      return format ? [{ url: url.href, format }] : [];
    })[0];

  const entries = deduplicateAttachments([...media.values()]);
  const first = (type: MediaAttachment['type']) => entries.find(entry => entry.type === type)?.url;
  return {
    media: entries.length ? entries : undefined,
    ...(transcript && { transcript }),
    imageUrl: mediaUrl(imageUrl, base)?.href || first('image'),
    videoUrl: first('video'),
    audioUrl: first('audio'),
    youtubeId: extractYouTubeId(first('youtube') || ''),
  };
}

function safeIsoDate(rawDate: unknown): string {
  const str = getText(rawDate).trim();
  if (!str) return new Date().toISOString();
  const parsed = Date.parse(str);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function makeStableId(sourceId: string, rawId: string, title: string): string {
  const base = `${sourceId}:${rawId || title}`;
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${sourceId}-${(hash >>> 0).toString(36)}`;
}

export function parseFeedPayload(rawText: string, source: NewsSource): NewsArticle[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // JSON Feed 1.0 / 1.1
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as {
        items?: Array<Record<string, unknown>>;
      };
      const items = Array.isArray(json.items) ? json.items : [];
      return items
        .slice(0, 25)
        .map((item) => {
          const title = decodeHtmlEntities(String(item.title || 'Ohne Titel')).trim();
          const html = String(item.content_html || item.summary || item.content_text || '');
          const summary = stripHtml(String(item.summary || item.content_text || html)).slice(0, 280);
          const link = String(item.url || item.external_url || '');
          const paragraphs = extractParagraphs(html, summary);
          const imageUrl =
            typeof item.image === 'string'
              ? item.image
              : typeof item.banner_image === 'string'
                ? item.banner_image
                : extractFirstImageFromHtml(html);

          const attachments = Array.isArray(item.attachments) ? item.attachments : [];
          const media = collectMedia({}, link, source.url, html, String(item.summary || ''), imageUrl, attachments);

          const authorObj = Array.isArray(item.authors) ? item.authors[0] : item.author;
          const authorName =
            typeof authorObj === 'object' && authorObj !== null
              ? String((authorObj as Record<string, unknown>).name || '')
              : undefined;

          return {
            id: makeStableId(source.id, String(item.id || link), title),
            sourceId: source.id,
            sourceName: source.name,
            sourceShortCode: source.shortCode,
            sourceColor: source.accentColor,
            title,
            summary: summary || title,
            paragraphs,
            link: link || source.url,
            linkIsFeed: !link || link === source.url,
            author: authorName || undefined,
            category: inferCategory(item.tags, title, summary, source.category),
            publishedAt: safeIsoDate(item.date_published || item.date_modified),
            readingTimeMin: estimateReadingTime(`${title} ${paragraphs.join(' ')}`),
            ...media,
            keywords: extractKeywords(title, summary),
          };
        })
        .filter((a) => a.title.length > 0);
    } catch {
      return [];
    }
  }

  // XML (RSS 2.0, RDF, or Atom 1.0)
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [];
  }

  // RSS 2.0 / RDF
  const rssChannel = (parsed.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  const rdfRoot = parsed['rdf:RDF'] as Record<string, unknown> | undefined;
  const rssItems = rssChannel
    ? asArray(rssChannel.item as Record<string, unknown> | Record<string, unknown>[])
    : rdfRoot
      ? asArray(rdfRoot.item as Record<string, unknown> | Record<string, unknown>[])
      : [];

  if (rssItems.length > 0) {
    return rssItems
      .slice(0, 25)
      .map((item) => {
        const title = stripHtml(getText(item.title)) || 'Ohne Titel';
        const rawHtml =
          getText(item['content:encoded']) ||
          getText(item.description) ||
          getText(item['itunes:summary']);
        const summary = stripHtml(getText(item.description) || rawHtml).slice(0, 280);
        const link = getText(item.link) || getText(item.guid);
        const paragraphs = extractParagraphs(rawHtml, summary);
        const imageUrl = pickImageUrl(item, rawHtml);
        const media = collectMedia(item, link, source.url, rawHtml, getText(item.description), imageUrl);
        const author = stripHtml(getText(item['dc:creator'] || item.author)) || undefined;

        return {
          id: makeStableId(source.id, getText(item.guid) || link, title),
          sourceId: source.id,
          sourceName: source.name,
          sourceShortCode: source.shortCode,
          sourceColor: source.accentColor,
          title,
          summary: summary || title,
          paragraphs,
          link: link || source.url,
          linkIsFeed: !link || link === source.url,
          author,
          category: inferCategory(item.category, title, summary, source.category),
          isBreaking: asArray(item.category).some(category =>
            /^(eilmeldung|breaking news)$/i.test(getText(category).trim())
          ),
          publishedAt: safeIsoDate(item.pubDate || item['dc:date']),
          readingTimeMin: estimateReadingTime(`${title} ${paragraphs.join(' ')}`),
          ...media,
          keywords: extractKeywords(title, summary),
        };
      })
      .filter((a) => a.title.length > 0);
  }

  // Atom 1.0
  const atomFeed = parsed.feed as Record<string, unknown> | undefined;
  const atomEntries = atomFeed
    ? asArray(atomFeed.entry as Record<string, unknown> | Record<string, unknown>[])
    : [];

  return atomEntries
    .slice(0, 25)
    .map((entry) => {
      const title = stripHtml(getText(entry.title)) || 'Ohne Titel';
      const mediaGroup = records(entry['media:group'])[0];
      const rawHtml = getText(entry.content) || getText(entry.summary) || getText(mediaGroup?.['media:description']);
      const summary = stripHtml(getText(entry.summary) || rawHtml).slice(0, 280);

      const links = asArray(entry.link as Record<string, unknown> | Record<string, unknown>[]);
      const altLink = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate');
      const link = String(altLink?.['@_href'] || getText(entry.id));

      const paragraphs = extractParagraphs(rawHtml, summary);
      const media = collectMedia(entry, link, source.url, rawHtml, getText(entry.summary), pickImageUrl(entry, rawHtml));
      const authorObj = entry.author as Record<string, unknown> | undefined;
      const author = authorObj ? stripHtml(getText(authorObj.name)) : undefined;

      return {
        id: makeStableId(source.id, getText(entry.id) || link, title),
        sourceId: source.id,
        sourceName: source.name,
        sourceShortCode: source.shortCode,
        sourceColor: source.accentColor,
        title,
        summary: summary || title,
        paragraphs,
        link: link || source.url,
        linkIsFeed: !link || link === source.url,
        author: author || undefined,
        category: inferCategory(entry.category, title, summary, source.category),
        publishedAt: safeIsoDate(entry.published || entry.updated),
        readingTimeMin: estimateReadingTime(`${title} ${paragraphs.join(' ')}`),
        ...media,
        keywords: extractKeywords(title, summary),
      };
    })
    .filter((a) => a.title.length > 0);
}
