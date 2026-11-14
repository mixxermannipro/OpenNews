import { Readability } from '@mozilla/readability';

export function extractArticle(document: Document, url: string) {
  const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  let ogImage: string | undefined;
  if (image) {
    try {
      const candidate = new URL(image, url);
      if (['http:', 'https:'].includes(candidate.protocol)) ogImage = candidate.href;
    } catch {
      // A broken image URL does not prevent reading.
    }
  }

  const content = new Readability(document, {
    serializer: element => element as Element,
    maxElemsToParse: 30_000,
    charThreshold: 300,
  }).parse()?.content;
  const paragraphs: string[] = [];
  const headingIndexes: number[] = [];
  if (content && typeof content !== 'string') {
    for (const node of content.querySelectorAll('p, h2, h3, li')) {
      if (node.tagName === 'LI' && node.querySelector('p, li')) continue;
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (/^H[23]$/.test(node.tagName)) headingIndexes.push(paragraphs.length);
      paragraphs.push(text);
    }
  }
  return { paragraphs, headingIndexes, ogImage };
}
