import { Readability } from '@mozilla/readability';
import { isTrackingPixelUrl } from './articleMedia.ts';

export interface ExtractedBlock {
  text: string;
  isHeading: boolean;
}

export interface CleanArticleResult {
  paragraphs: string[];
  headingIndexes: number[];
  blockedWall?: boolean;
}

export interface ExtractedArticle extends CleanArticleResult {
  ogImage?: string;
}

/**
 * Strips heavy non-editorial markup before JSDOM parsing to cut CPU/RAM usage
 * and avoid parsing inline scripts, stylesheets, templates, and inline SVGs.
 */
export function preStripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'form',
  'button',
  'svg',
  'nav',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="complementary"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '[aria-label*="breadcrumb" i]',
  '[class*="breadcrumb" i]',
  '[id*="breadcrumb" i]',
  '[class*="paywall" i]',
  '[id*="paywall" i]',
  '[data-component*="paywall" i]',
  '[class*="consent" i]',
  '[id*="consent" i]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="newsletter" i]',
  '[class*="outbrain" i]',
  '[class*="taboola" i]',
  '[class*="related-article" i]',
  '[class*="related-links" i]',
  '[class*="more-stories" i]',
  '[class*="recommendations" i]',
  '[class*="audio-player" i]',
  '[class*="audioplayer" i]',
  '[class*="podcast-player" i]',
  '[class*="share-bar" i]',
  '[class*="social-share" i]',
  '[class*="print-error" i]',
  '[class*="print-notice" i]',
].join(', ');

function removeDomNoise(document: Document): void {
  const candidates = document.querySelectorAll(NOISE_SELECTORS);
  for (const el of candidates) {
    // Never remove a wrapper that contains the main article or headline.
    if (el.querySelector('article, main, h1')) continue;
    el.remove();
  }
}

function extractCleanNodeText(node: Element): string {
  const parts: string[] = [];
  const walk = (current: Node) => {
    if (current.nodeType === 3) {
      parts.push(current.textContent ?? '');
      return;
    }
    if (current.nodeType !== 1) return;
    const el = current as Element;
    const tag = el.tagName;
    if (tag === 'BR') {
      parts.push(' ');
      return;
    }
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'BUTTON') {
      return;
    }
    const beforeLen = parts.length;
    for (const child of el.childNodes) {
      walk(child);
    }
    const added = parts.slice(beforeLen).join('');
    // Insert boundary space between adjacent non-dropcap element siblings (e.g., BBC byline spans).
    if (added && !/\s$/.test(added) && el.nextSibling) {
      const trimmedAdded = added.trim();
      const nextText = el.nextSibling.textContent ?? '';
      const isInlineFormat = /^(?:SPAN|EM|STRONG|B|I|U|MARK|SMALL|SUB|SUP|ABBR|CITE|CODE|Q|A)$/i.test(tag);
      const isDropCap = trimmedAdded.length === 1 && /^\p{Lu}$/u.test(trimmedAdded) && /^\p{Ll}/u.test(nextText);
      const startsWithPunct = /^[\s.,;:!?)\]»”’"'–—-]/.test(nextText);
      const endsWithOpen = /[\s([«„“‘"'-]$/.test(added);
      if (!isDropCap && !startsWithPunct && !endsWithOpen) {
        // Add space for block-like children or when a word boundary was lost across spans (e.g., "By"+"Olga", "Kiryukhina"+"BBC")
        const camelBoundary = /[\p{Ll}\p{N}]$/u.test(added) && /^\p{Lu}/u.test(nextText);
        if (!isInlineFormat || camelBoundary) {
          parts.push(' ');
        }
      }
    }
  };
  walk(node);
  return parts
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fixSplitDropCap(text: string): string {
  // Repair broken German/European drop-caps like "A ls Bill Kaulitz..." or "D ie Regierung..."
  // Never merge valid standalone English words ("A new study", "I think").
  if (/^[B-HJ-ZÄÖÜ]\s+[a-zäöüß]{2,}/u.test(text)) {
    return text.replace(/^([B-HJ-ZÄÖÜ])\s+([a-zäöüß]{2,})/u, '$1$2');
  }
  if (/^A\s+(?:ls|m|n|b|uch|uf|us|ber|lle[nsmr]?|nders|ngesichts|nfangs|ktuell|ller)\b/.test(text)) {
    return text.replace(/^A\s+/, 'A');
  }
  if (/^I\s+(?:n|m|st|hr[emns]?|ch|mmer|nzwischen|nsbesondere|ndem)\b/.test(text)) {
    return text.replace(/^I\s+/, 'I');
  }
  return text;
}

const CONSENT_WALL_PATTERNS: RegExp[] = [
  /\baccept cookies\b/i,
  /\bconsent is not possible inside an iframe\b/i,
  /\bvisit golem\.de as usual\b/i,
  /\bsubscribe to golem pur\b/i,
  /\bprecise geolocation data\b/i,
  /\bstore and\/or access information on a device\b/i,
  /\bpersonalised advertising and content\b/i,
  /\bSie entscheiden darüber, wie Sie unsere Inhalte nutzen wollen\b/i,
  /\bBitte deaktivieren Sie sämtliche Hard- und Software-Komponenten\b/i,
  /\bSie haben ein PUR-Abo\b/i,
  /\bMit dem PUR-Abo lesen Sie\b/i,
  /\bWillkommen bei DER STANDARD\b/i,
  /\bplease disable your ad\s?blocker\b/i,
  /\badblocker deaktivieren\b/i,
  /\bplease enable (?:javascript|cookies)\b/i,
  /\bchecking your browser before accessing\b/i,
  /^Cookies zustimmen$/i,
  /\bwie gewohnt mit Werbung und Tracking\b/i,
  /\bDie Zustimmung in einem iFrame ist nicht möglich\b/i,
  /\bDer Zustimmungs-Dialog konnte nicht korrekt geladen werden\b/i,
  /\bGolem pur\b/i,
  /\bohne Analyse- und Werbecookies nutzen\b/i,
  /\bCookies, Geräte-Kennungen oder andere Informationen auf Ihrem Gerät gespeichert oder abgerufen werden\b/i,
  /\bAnzeigen und Inhalte können basierend auf einem Profil personalisiert werden\b/i,
  /\bgenaue Standortdaten verarbeitet werden\b/i,
  /\bCookies & Tracking\b/i,
  /\bBereits Pur-Leser\b/i,
  /\bMöglichkeit zum Widerruf finden Sie in unserer Datenschutzerklärung\b/i,
];

const SINGLE_LINE_NOISE_PATTERNS: RegExp[] = [
  // Audio/video scrubber timestamps
  /^\d{1,2}:\d{2}(?::\d{2})?(?:\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?)?$/,
  /^[/|·•–—]+$/,
  // Standalone dates, update timestamps, "Online seit ..."
  /^(?:Stand|Aktualisiert|Update|Updated|Veröffentlicht|Published|Online seit|Erstellt)(?:\s*:|\s+am)?\s+(?=.*(?:\d|heute|gestern|Uhr))(?:(?![.!?]\s+\p{Lu}).){1,75}$/iu,
  /^\d{1,2}\.\d{1,2}\.\d{2,4}(?:[\s,|–-]+\d{1,2}[:.]\d{2}(?:\s*Uhr)?)?$/i,
  /^(?:vor\s+\d+\s+(?:Sekunden?|Minuten?|Stunden?|Tagen?)|\d+\s+(?:seconds?|minutes?|hours?|days?)\s+ago)$/i,
  // Photo & media credits
  /^(?:Foto|Fotos|Bild|Bilder|Quelle|Quellen|Grafik|Illustration|Video|Archivbild|Symbolbild|Beitragsbild|Image source|Image caption|Photo|Photo credit|Credit|Credits|Picture|Bildnachweis)\s*[:,-]\s*.{0,160}$/i,
  /^[^.!?]{2,95}\/(?:Getty Images|AFP|AP|Reuters|dpa|imago(?:\s+images)?|epa|KEYSTONE|Picture Alliance|Shutterstock|Alamy|iStock|ullstein bild)(?:[^.!?]{0,65})$/i,
  // Print preview & license boilerplate (SPIEGEL, ORF, etc.)
  /^Dieser Ausdruck wurde am .+ erstellt und ist ausschließlich für den persönlichen Gebrauch lizenziert/i,
  /^Nicht alle Bilder konnten vollständig geladen werden\.\s*Bitte schließen Sie die Druckvorschau/i,
  /^Alle Rechte vorbehalten\.?(?:\s*©.*)?$/i,
  // Paywall / Abo / Consent / Adblock / Newsletter / Follow promos
  /^(?:Jetzt Artikel freischalten|Wöchentlich den SPIEGEL als E-Paper lesen|Sie haben bereits ein Digital-Abo|Laufzeit \d+ Wochen|Danach \d+[,.]\d+\s*€|Jederzeit kündbar|SPIEGEL\+ testen|Jetzt kostenlos testen|Zum Abo|Abo abschließen|Bereits Abonnent\??)/i,
  /^(?:Willkommen bei DER STANDARD|Sie entscheiden darüber, wie Sie unsere Inhalte nutzen wollen|Bitte deaktivieren Sie sämtliche Hard- und Software-Komponenten|Sie haben ein PUR-Abo\??|Mit dem PUR-Abo lesen Sie|Zustimmen und weiterlesen)/i,
  /^(?:3 Monate für nur \d+\s*Euro|wochentaz ausprobieren|Mit Zukunftsteil|Mit Regionalteil|taz unterstützen|Jetzt abonnieren|Newsletter abonnieren|Zum Newsletter)/i,
  /^(?:Klicken Sie hier, um sich Artikel von .+ in der Google-Suche bevorzugt anzeigen zu lassen\.?|Jetzt aktivieren|Google)$/i,
  /^Follow topics and authors from this story to see more like this/i,
  // Liveblog & UI chrome labels
  /^(?:Mehr laden|TickarooLive Blog Software|Live Blog Software|Kommentare laden|Kommentare anzeigen|Leserkommentare|Artikel teilen|Teilen|Drucken|Merken|Anhören|Vorlesen|Zur Startseite|Zum Seitenanfang|Lesedauer:?\s*\d+\s*Min\.?)$/i,
  // Partner / affiliate boxes (Handelsblatt etc.)
  /^(?:IT BOLTWISE\b|Presseportal\s+Direkt hier lesen!?|STELLENMARKT\b|Expertentesten\.de\b|Anzeige\b|Werbung\b|Sponsored\b|Verlagsangebot\b|Partnerangebot\b)/i,
  // Short agency/author codes
  /^(?:dpa|afp|rtr|reuters|sid|kna|epd|apa|sda|red|taz|faz|sz|welt|zeit|ntv|orf|srf)$/i,
];

const TRAILING_SECTION_CUTOFF =
  /^(?:Weitere empfehlenswerte Artikel|Weitere Deals\b|Weitere Artikel\b|Mehr zum Thema\b|Das könnte Sie auch interessieren\b|Lesen Sie auch\b|Empfehlungen der Redaktion\b|Beliebte Artikel\b|Meistgelesen\b|Verwandte Artikel\b|Related (?:Stories|Articles|Topics)\b|More from \b|Recommended for you\b|Partnerangebote\b|Verlagsangebote\b|Anzeigen\b)/i;

const BREADCRUMB_ROOTS = new Set([
  'startseite',
  'home',
  'nachrichten',
  'news',
  'übersicht',
  'ressorts',
  'aktuell',
  'top-themen',
]);

function normalizeCompare(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isSameTitle(candidate: string, title?: string): boolean {
  if (!title) return false;
  const a = normalizeCompare(candidate);
  const b = normalizeCompare(title);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 24 && b.length >= 24 && (a.includes(b) || b.includes(a))) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return ratio >= 0.72;
  }
  return false;
}

function isConsentWallLine(text: string): boolean {
  return CONSENT_WALL_PATTERNS.some(pattern => pattern.test(text));
}

function isNoiseBlock(text: string, isHeading: boolean): boolean {
  if (!text) return true;
  if (isConsentWallLine(text)) return true;
  if (SINGLE_LINE_NOISE_PATTERNS.some(pattern => pattern.test(text))) return true;
  // Short BBC byline clutter ("By Olga Ivshina and Yaroslava Kiryukhina BBC Russian")
  if (!isHeading && text.length < 110 && /^By\s+\p{Lu}[\p{L}\s.,'-]+\bBBC\b/u.test(text)) return true;
  // Stray 1-4 character author initials or punctuation tokens (e.g., WELT "lwö")
  if (!isHeading && text.length <= 5 && !/[.!?]$/.test(text)) return true;
  return false;
}

export function cleanExtractedBlocks(
  rawBlocks: ExtractedBlock[],
  options: { title?: string } = {},
): CleanArticleResult {
  if (!rawBlocks.length) return { paragraphs: [], headingIndexes: [] };

  let wallHits = 0;
  let nonWallProseChars = 0;
  let nonWallProseCount = 0;
  for (const block of rawBlocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (isConsentWallLine(text)) {
      wallHits++;
    } else if (!block.isHeading && text.length >= 60 && !isNoiseBlock(text, false)) {
      nonWallProseChars += text.length;
      nonWallProseCount++;
    }
  }
  if (wallHits >= 2 && (nonWallProseChars < 160 || nonWallProseCount < 2)) {
    return { paragraphs: [], headingIndexes: [], blockedWall: true };
  }

  // Filter per-block noise and truncate trailing related-link / deals dumps
  const filtered: ExtractedBlock[] = [];
  let proseSeen = 0;

  for (const raw of rawBlocks) {
    const text = fixSplitDropCap(raw.text.replace(/\s+/g, ' ').trim());
    if (!text) continue;

    if (proseSeen >= 2 && text.length <= 120 && TRAILING_SECTION_CUTOFF.test(text)) {
      break;
    }
    if (isNoiseBlock(text, raw.isHeading)) continue;

    filtered.push({ text, isHeading: raw.isHeading });
    if (!raw.isHeading && text.length >= 50) proseSeen++;
  }

  // Strip leading navigation breadcrumb chains (e.g., Handelsblatt "Startseite / Finanzen / Märkte", WELT "Home / Sport / Fußball")
  let start = 0;
  if (start < filtered.length && BREADCRUMB_ROOTS.has(normalizeCompare(filtered[start].text))) {
    start++;
    let skippedSections = 0;
    while (
      start < filtered.length
      && skippedSections < 5
      && filtered[start].text.length <= 36
      && !/[.!?]$/.test(filtered[start].text)
      && filtered[start].text.split(/\s+/).length <= 4
    ) {
      start++;
      skippedSections++;
    }
  }

  // Strip leading duplicate article title (and eyebrow immediately above an exact duplicate title)
  while (start < filtered.length && start < 4) {
    const current = filtered[start];
    if (isSameTitle(current.text, options.title)) {
      start++;
      continue;
    }
    if (
      start + 1 < filtered.length
      && current.text.length <= 45
      && !/[.!?]$/.test(current.text)
      && isSameTitle(filtered[start + 1].text, options.title)
    ) {
      start += 2;
      continue;
    }
    break;
  }

  // Deduplicate consecutive identical blocks & long exact duplicates
  const paragraphs: string[] = [];
  const headingIndexes: number[] = [];
  const seenLongBlocks = new Set<string>();
  let prevNorm = '';

  for (let i = start; i < filtered.length; i++) {
    const { text, isHeading } = filtered[i];
    const norm = normalizeCompare(text);
    if (!norm) continue;

    // Consecutive duplicate (e.g. a heading accidentally echoed as <p> or <h2> twice)
    if (norm === prevNorm) {
      if (isHeading && paragraphs.length > 0 && !headingIndexes.includes(paragraphs.length - 1)) {
        headingIndexes.push(paragraphs.length - 1);
      }
      continue;
    }

    if (norm.length >= 45 && seenLongBlocks.has(norm)) continue;
    if (norm.length >= 45) seenLongBlocks.add(norm);

    if (isHeading) headingIndexes.push(paragraphs.length);
    paragraphs.push(text);
    prevNorm = norm;
  }

  // Drop dangling trailing headings or bare "... lesen Sie hier:" teasers
  while (paragraphs.length > 0) {
    const lastIdx = paragraphs.length - 1;
    const lastText = paragraphs[lastIdx];
    const isLastHeading = headingIndexes.includes(lastIdx);
    const isBareTeaser = /lesen Sie hier:\s*$/i.test(lastText) || /^(?:Mehr dazu|Weiterlesen|Read more)\b.{0,40}$/i.test(lastText);
    if (isLastHeading || isBareTeaser) {
      paragraphs.pop();
      if (isLastHeading) headingIndexes.pop();
    } else {
      break;
    }
  }

  return { paragraphs, headingIndexes };
}

export function extractArticle(document: Document, url: string, articleTitle?: string): ExtractedArticle {
  const image =
    document.querySelector('meta[property="og:image"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  let ogImage: string | undefined;
  if (image) {
    try {
      const candidate = new URL(image, url);
      if (['http:', 'https:'].includes(candidate.protocol) && !isTrackingPixelUrl(candidate.href)) {
        ogImage = candidate.href;
      }
    } catch {
      // A broken image URL does not prevent reading.
    }
  }

  const pageTitle =
    articleTitle
    || document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
    || document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();

  removeDomNoise(document);

  const content = new Readability(document, {
    serializer: element => element as Element,
    maxElemsToParse: 30_000,
    charThreshold: 300,
  }).parse()?.content;

  const rawBlocks: ExtractedBlock[] = [];
  if (content && typeof content !== 'string') {
    for (const node of content.querySelectorAll('p, h2, h3, li, blockquote')) {
      // Skip wrapper nodes that contain child editorial blocks (prevents duplicate headings/paragraphs)
      if (node.querySelector('p, h2, h3, li, blockquote')) continue;
      // Skip figcaption text that Readability may have preserved
      if (node.closest('figcaption')) continue;
      const text = extractCleanNodeText(node);
      if (!text) continue;
      rawBlocks.push({
        text,
        isHeading: /^H[23]$/.test(node.tagName),
      });
    }
  }

  const cleaned = cleanExtractedBlocks(rawBlocks, { title: pageTitle });
  return { ...cleaned, ogImage };
}
