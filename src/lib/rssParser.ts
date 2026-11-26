import { transcriptFormat } from './transcript';
import { XMLParser } from 'fast-xml-parser';
import { deduplicateAttachments, isTrackingPixelUrl } from './articleMedia';
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
    .replace(/&nbsp;|&thinsp;|&ensp;|&emsp;/g, ' ')
    .replace(/&shy;|&zwj;|&zwnj;/g, '')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&bdquo;/g, '„')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&sbquo;/g, '‚')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&euro;/g, '€')
    .replace(/&sect;/g, '§')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&times;/g, '×')
    .replace(/&middot;/g, '·')
    .replace(/&bull;/g, '•')
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

const RSS_FEED_BOILERPLATE =
  /^(?:The post .+ appeared first on .+|Der Beitrag .+ erschien zuerst auf .+|(?:Weiterlesen|Read more|Mehr lesen)(?:\s*[.…»›→]*)?)$/i;

export function extractParagraphs(htmlOrText: string, fallbackSummary: string): string[] {
  const clean = stripHtml(htmlOrText);
  const parts = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 24 && !RSS_FEED_BOILERPLATE.test(p));
  if (parts.length > 0) return parts.slice(0, 24);
  if (fallbackSummary.trim().length > 0) return [fallbackSummary.trim()];
  return [];
}

function isTinyImageAttributes(attrs: string): boolean {
  const widthMatch = attrs.match(/\bwidth\s*=\s*["']?(\d+)/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']?(\d+)/i);
  const w = widthMatch ? Number(widthMatch[1]) : undefined;
  const h = heightMatch ? Number(heightMatch[1]) : undefined;
  return (w !== undefined && w > 0 && w <= 24) || (h !== undefined && h > 0 && h <= 24);
}

export function extractFirstImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;
  for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = match[1];
    if (isTinyImageAttributes(attrs)) continue;
    const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const rawSrc = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3];
    if (rawSrc && /^https?:\/\//i.test(rawSrc)) {
      const candidate = decodeHtmlEntities(rawSrc);
      if (!isTrackingPixelUrl(candidate)) return candidate;
    }
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

const feedSections = new Map<string, NewsSource['category']>([
  ['politik', 'Politik'], ['inland', 'Politik'], ['ausland', 'Politik'],
  ['wirtschaft', 'Wirtschaft'], ['finanzen', 'Wirtschaft'],
  ['technologie', 'Technologie'], ['digital', 'Technologie'], ['netzwelt', 'Technologie'], ['tech', 'Technologie'],
  ['wissenschaft', 'Wissenschaft'], ['wissen', 'Wissenschaft'], ['science', 'Wissenschaft'],
  ['europa', 'Europa'],
  ['gesellschaft', 'Gesellschaft'], ['panorama', 'Gesellschaft'], ['gesundheit', 'Gesellschaft'],
  ['kultur', 'Kultur'], ['feuilleton', 'Kultur'], ['medien', 'Kultur'],
  ['sport', 'Sport'], ['fußball', 'Sport'], ['football', 'Sport'],
]);

function matchCategoryText(hay: string): Exclude<NewsCategory, 'Alle' | 'Für dich'> | undefined {
  if (/\b(sport|bundesliga|fußball|fussball|champions league|europa league|conference league|wm-star|wm-qualifikation|olympia|formel 1|tennis|handball|eishockey|biathlon|ski-weltcup|weltcup|fc bayern|bvb|borussia|dfb|bundestrainer|torwart|spieltag|transfermarkt|abstiegskampf|meisterschale|nba|nfl|nhl|tour de france|grand slam|champions)\b/u.test(hay)) {
    return 'Sport';
  }
  if (/\b(eu-kommission|eu-parlament|europaparlament|europäische union|europapolitik|eu-gipfel|eu-staaten|brüssel|ezb|eurozone|strasbourg|schengen|eu-)\b/u.test(hay)) {
    return 'Europa';
  }
  if (/(?:^|[\s\-:„"‚'(/])(?:[\p{L}]*politik|bundestag|bundesrat|bundesregierung|regierung|kanzler(?:amt|in)?|wahl(?:kampf|en)?|partei(?:en)?|koalition|diplomatie|nato|ukraine|gaza|minister(?:ium|in|präsident[\p{L}]*)?|renten(?:streit|paket|reform|alter|kasse|politik)|rente mit 63|respekt-rente|sozialstaat|bundeswehr|sanktion(?:en)?|parlament|senat|kongress|waffenruhe|asyl[\p{L}]*|migration)\b/u.test(hay)) {
    return 'Politik';
  }
  if (/\b(europa|europäisch[\p{L}]*)\b/u.test(hay)) {
    return 'Europa';
  }
  if (/(?:^|[\s\-:„"‚'(/])(?:[\p{L}]*wirtschaft|wirtschafts[\p{L}]*|börse|dax|inflation|aktien|konjunktur|unternehmen|handel(?:sstreit|skrieg)?|zinsen|leitzins|bank(?:en)?|euro|zölle|us-zölle|strafzölle|zollkonflikt|tarifvertr[\p{L}]*|arbeitsmarkt|gewerkschaft|insolvenz|stellenabbau|quartalszahlen|milliarden|autoindustrie|energiepreis|strompreis|gaspreis)\b/u.test(hay)) {
    return 'Wirtschaft';
  }
  if (/\b(ki|künstliche intelligenz|ai|software|chip|chips|halbleiter|hardware|apple|google|microsoft|openai|nvidia|linux|android|iphone|smartphone|cyber[\p{L}]*|hacker|ransomware|tech|digital[\p{L}]*|robot(?:er|axi)?|quantencomputer|rechenzentrum|cloud|open source)\b/u.test(hay)) {
    return 'Technologie';
  }
  if (/\b(wissenschaft|forschung|forscher[\p{L}]*|studie|nasa|esa|weltraum|raumfahrt|asteroid[\p{L}]*|krater|einschlagkrater|planet|mars|satellit[\p{L}]*|teleskop|klima(?:wandel|krise|schutz)?|energie|physik|chemie|biologie|medizin|biotech|evolution|neandertaler|homo sapiens|archäolog[\p{L}]*|fossil|genetik|impfstoff|viren|masern[\p{L}]*|gesundheitsbehörde)\b/u.test(hay)) {
    return 'Wissenschaft';
  }
  if (/\b(gesellschaft|sturmwarnung|unwetter|hochwasser|erdbeben|waldbrand|großbrand|polizei|ermittlungen|gericht|urteil|prozess|schule|bildung|kita|pflege|krankenhaus|bahnstreik|verbraucher|rückruf|warnung)\b/u.test(hay)) {
    return 'Gesellschaft';
  }
  if (/\b(kultur|film|kino|serie|musik|album|konzert|buch|roman|literatur|kunst|theater|oper|museum|ausstellung|feuilleton|oscar|berlinale|parade|supermodel|schauspieler(?:in)?|sänger(?:in)?|regisseur(?:in)?|mode)\b/u.test(hay)) {
    return 'Kultur';
  }
  return undefined;
}

export function cleanAuthor(raw: string): string | undefined {
  const cleaned = stripHtml(raw)
    .replace(/^[\s\-–—,:|•/]+/, '')
    .replace(/[\s\-–—,:|•/]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? cleaned : undefined;
}

export function inferCategory(
  rawCategory: unknown,
  title: string,
  summary: string,
  fallback: Exclude<NewsCategory, 'Alle' | 'Für dich'>
): Exclude<NewsCategory, 'Alle' | 'Für dich'> {
  const labels = asArray(rawCategory).map(value => {
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      return String(record['#text'] || record['@_term'] || '');
    }
    return String(value || '');
  });
  for (const label of labels) {
    const section = feedSections.get(label.trim().toLowerCase());
    if (section) return section;
  }
  if (/\b(?:bundespräsiden[\p{L}]*|steinmeier|afd)\b/iu.test(title)) return 'Politik';
  const raw = labels.join(' ');
  const fromTitle = matchCategoryText(`${raw} ${title}`.toLowerCase());
  if (fromTitle) return fromTitle;
  const fromSummary = matchCategoryText(summary.toLowerCase());
  if (fromSummary) return fromSummary;
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

function pickImageUrl(item: Record<string, unknown>, rawHtml: string, channelImage?: string): string | undefined {
  for (const media of asArray(item['media:content'] as Record<string, unknown> | Record<string, unknown>[])) {
    const url = media?.['@_url'];
    const medium = media?.['@_medium'];
    const mime = String(media?.['@_type'] || '').toLowerCase();
    if (typeof url === 'string' && (medium === 'image' || mime.startsWith('image/')) && !isTrackingPixelUrl(url)) {
      return url;
    }
  }
  const group = item['media:group'] as Record<string, unknown> | undefined;
  const mediaThumbs = [...records(item['media:thumbnail']), ...records(group?.['media:thumbnail'])];
  for (const t of mediaThumbs) {
    const url = t?.['@_url'] as string | undefined;
    if (url && !isTrackingPixelUrl(url)) return url;
  }
  const enclosures = asArray(item['enclosure'] as Record<string, unknown> | Record<string, unknown>[]);
  for (const enc of enclosures) {
    const url = enc?.['@_url'] as string | undefined;
    const type = String(enc?.['@_type'] || '');
    if (url && type.startsWith('image/') && !isTrackingPixelUrl(url)) return url;
  }
  const itunesImage = item['itunes:image'] as Record<string, unknown> | undefined;
  if (itunesImage?.['@_href'] && !isTrackingPixelUrl(String(itunesImage['@_href']))) {
    return String(itunesImage['@_href']);
  }

  return extractFirstImageFromHtml(rawHtml) || channelImage;
}

function pickChannelImageUrl(channel: Record<string, unknown> | undefined, baseUrl: string): string | undefined {
  if (!channel) return undefined;
  const candidates: unknown[] = [];
  const itunesImage = channel['itunes:image'] as Record<string, unknown> | string | undefined;
  if (typeof itunesImage === 'string') candidates.push(itunesImage);
  else if (itunesImage && typeof itunesImage === 'object') candidates.push(itunesImage['@_href'], itunesImage['#text']);
  const rssImage = channel.image as Record<string, unknown> | string | undefined;
  if (typeof rssImage === 'string') candidates.push(rssImage);
  else if (rssImage && typeof rssImage === 'object') candidates.push(rssImage.url, rssImage['@_href']);
  candidates.push(getText(channel.logo), getText(channel.icon));
  for (const thumb of records(channel['media:thumbnail'])) candidates.push(thumb['@_url']);

  for (const raw of candidates) {
    const resolved = mediaUrl(raw, baseUrl)?.href;
    if (resolved && !isTrackingPixelUrl(resolved)) return resolved;
  }
  return undefined;
}

export function parseDurationSeconds(raw: unknown): number | undefined {
  const text = getText(raw).trim();
  if (!text) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const secs = Math.round(Number(text));
    return secs > 0 && secs < 24 * 3600 ? secs : undefined;
  }
  const parts = text.split(':').map(part => Number(part.trim()));
  if (parts.length >= 2 && parts.length <= 3 && parts.every(n => Number.isFinite(n) && n >= 0)) {
    const secs = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
    return secs > 0 && secs < 24 * 3600 ? Math.round(secs) : undefined;
  }
  return undefined;
}

function extractItemDurationSec(item: Record<string, unknown>): number | undefined {
  const fromItunes = parseDurationSeconds(item['itunes:duration']);
  if (fromItunes) return fromItunes;
  for (const group of [item, ...records(item['media:group'])]) {
    for (const entry of records(group['media:content'])) {
      const fromMedia = parseDurationSeconds(entry['@_duration']);
      if (fromMedia) return fromMedia;
    }
  }
  return undefined;
}

/**
 * Cleanly terminates an oversized RSS/Atom XML prefix (e.g. a 9 MB podcast archive)
 * at the last complete </item> or </entry> tag so fast-xml-parser extracts all newest episodes.
 */
export function repairTruncatedFeedXml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('{')) return raw;

  const lastItemEnd = trimmed.lastIndexOf('</item>');
  if (lastItemEnd !== -1 && !/<\/rss>\s*$/i.test(trimmed) && !/<\/rdf:RDF>\s*$/i.test(trimmed)) {
    const head = trimmed.slice(0, lastItemEnd + '</item>'.length);
    if (/<rdf:RDF\b/i.test(head)) return `${head}\n</rdf:RDF>`;
    return `${head}\n</channel>\n</rss>`;
  }

  const lastEntryEnd = trimmed.lastIndexOf('</entry>');
  if (lastEntryEnd !== -1 && !/<\/feed>\s*$/i.test(trimmed)) {
    return `${trimmed.slice(0, lastEntryEnd + '</entry>'.length)}\n</feed>`;
  }

  return raw;
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

    if (type === 'image' && isTrackingPixelUrl(url.href)) return;
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
      if (name === 'img' && isTinyImageAttributes(tag[3])) continue;
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

  const durationSec = extractItemDurationSec(item);
  const rawEntries = deduplicateAttachments([...media.values()]);
  const entries = durationSec
    ? rawEntries.map(entry => (entry.type === 'audio' || entry.type === 'video' ? { ...entry, durationSec } : entry))
    : rawEntries;
  const first = (type: MediaAttachment['type']) => entries.find(entry => entry.type === type)?.url;
  const resolvedImage = mediaUrl(imageUrl, base)?.href;
  const safeImage = resolvedImage && !isTrackingPixelUrl(resolvedImage) ? resolvedImage : undefined;
  return {
    media: entries.length ? entries : undefined,
    ...(transcript && { transcript }),
    ...(durationSec && { durationSec }),
    imageUrl: first('image') || safeImage,
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
          const rawLink = String(item.url || item.external_url || '');
          const link = mediaUrl(rawLink, source.url)?.href || '';
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
              ? cleanAuthor(String((authorObj as Record<string, unknown>).name || ''))
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
            author: authorName,
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
    const channelImage = pickChannelImageUrl(rssChannel, source.url);
    return rssItems
      .slice(0, 25)
      .map((item) => {
        const title = stripHtml(getText(item.title)) || 'Ohne Titel';
        const rawHtml =
          getText(item['content:encoded']) ||
          getText(item.description) ||
          getText(item['itunes:summary']);
        const summary = stripHtml(getText(item.description) || rawHtml).slice(0, 280);
        const rawLink = getText(item.link) || getText(item.guid);
        const link = mediaUrl(rawLink, source.url)?.href || '';
        const paragraphs = extractParagraphs(rawHtml, summary);
        const imageUrl = pickImageUrl(item, rawHtml, channelImage);
        const media = collectMedia(item, link, source.url, rawHtml, getText(item.description), imageUrl);
        const author = cleanAuthor(getText(item['dc:creator'] || item.author));

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
  const atomChannelImage = pickChannelImageUrl(atomFeed, source.url);
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
      const rawLink = String(altLink?.['@_href'] || getText(entry.id));
      const link = mediaUrl(rawLink, source.url)?.href || '';

      const paragraphs = extractParagraphs(rawHtml, summary);
      const media = collectMedia(entry, link, source.url, rawHtml, getText(entry.summary), pickImageUrl(entry, rawHtml, atomChannelImage));
      const authorObj = entry.author as Record<string, unknown> | undefined;
      const author = authorObj ? cleanAuthor(getText(authorObj.name)) : undefined;

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
