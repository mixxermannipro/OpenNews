import { cleanExtractedBlocks } from '../../src/lib/articleExtraction.ts';
import { isTrackingPixelUrl } from '../../src/lib/articleMedia.ts';
import { handlePagesApiRequest, type ExtractedArticlePayload, type PagesApiEnv } from '../../src/lib/pagesApi.ts';
import { hasPaywallMarkup } from '../../src/lib/publisherPolicy.ts';

interface PagesContext {
  request: Request;
  env: PagesApiEnv;
}

interface HTMLRewriterElement {
  getAttribute(name: string): string | null;
  onEndTag(handler: () => void): void;
}

interface HTMLRewriterText {
  text: string;
  lastInTextNode: boolean;
}

declare class HTMLRewriter {
  on(selector: string, handlers: {
    element?: (element: HTMLRewriterElement) => void;
    text?: (text: HTMLRewriterText) => void;
  }): HTMLRewriter;
  transform(response: Response): Response;
}

async function extractArticleWithHtmlRewriter(
  response: Response,
  finalUrl: string,
  articleTitle?: string,
): Promise<ExtractedArticlePayload> {
  let ogImage: string | undefined;
  let ignoreDepth = 0;
  let articleDepth = 0;
  let mainDepth = 0;
  let robotsBlocked = false;
  let paywallDetected = false;
  let ldJsonBuffer = '';
  let insideLdJson = false;

  const articleBlocks: Array<{ text: string; isHeading: boolean }> = [];
  const mainBlocks: Array<{ text: string; isHeading: boolean }> = [];
  const bodyBlocks: Array<{ text: string; isHeading: boolean }> = [];

  let activeBlock: { tag: string; buffer: string; scope: 'article' | 'main' | 'body' } | null = null;

  const pushActive = () => {
    if (!activeBlock) return;
    const text = activeBlock.buffer.replace(/\s+/g, ' ').trim();
    const isHeading = activeBlock.tag === 'h2' || activeBlock.tag === 'h3';
    if (text.length >= (isHeading ? 4 : 25)) {
      const target =
        activeBlock.scope === 'article'
          ? articleBlocks
          : activeBlock.scope === 'main'
            ? mainBlocks
            : bodyBlocks;
      target.push({ text, isHeading });
    }
    activeBlock = null;
  };

  const rewriter = new HTMLRewriter()
    .on('meta[name], meta[property]', {
      element(el) {
        const name = (el.getAttribute('name') || el.getAttribute('property') || '').trim().toLowerCase();
        const content = el.getAttribute('content') || '';
        if (['robots', 'googlebot', 'bingbot', 'gptbot', 'ccbot', 'anthropic-ai'].includes(name)) {
          if (/\b(?:noarchive|noai|noimageai)\b/i.test(content)) {
            robotsBlocked = true;
          }
        }
        if ((name === 'article:content_tier' || name === 'piano:tier')
          && /^(?:locked|paid|subscriber|subscriber-only)$/i.test(content.trim())) {
          paywallDetected = true;
        }
      },
    })
    .on('[itemprop="isAccessibleForFree"]', {
      element(el) {
        if ((el.getAttribute('content') || '').trim().toLowerCase() === 'false') {
          paywallDetected = true;
        }
      },
    })
    .on('[data-paywall-state]', {
      element(el) {
        if (/^(?:locked|closed|active)$/i.test((el.getAttribute('data-paywall-state') || '').trim())) {
          paywallDetected = true;
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        insideLdJson = true;
        ldJsonBuffer = '';
        el.onEndTag(() => {
          insideLdJson = false;
          if (hasPaywallMarkup(ldJsonBuffer)) {
            paywallDetected = true;
          }
          ldJsonBuffer = '';
        });
      },
      text(chunk) {
        if (insideLdJson && ldJsonBuffer.length < 32_768) {
          ldJsonBuffer += chunk.text;
        }
      },
    })
    .on('meta[property="og:image"]', {
      element(el) {
        if (ogImage) return;
        const content = el.getAttribute('content');
        if (!content) return;
        try {
          const candidate = new URL(content, finalUrl);
          if (['http:', 'https:'].includes(candidate.protocol) && !isTrackingPixelUrl(candidate.href)) {
            ogImage = candidate.href;
          }
        } catch {
          // Ignore malformed og:image URLs.
        }
      },
    })
    .on('nav, header, footer, aside, script, style, noscript, svg, form, button, figcaption', {
      element(el) {
        ignoreDepth++;
        el.onEndTag(() => {
          ignoreDepth = Math.max(0, ignoreDepth - 1);
        });
      },
    })
    .on('article', {
      element(el) {
        articleDepth++;
        el.onEndTag(() => {
          articleDepth = Math.max(0, articleDepth - 1);
        });
      },
    })
    .on('main', {
      element(el) {
        mainDepth++;
        el.onEndTag(() => {
          mainDepth = Math.max(0, mainDepth - 1);
        });
      },
    })
    .on('p, h2, h3, li', {
      element(el) {
        if (ignoreDepth > 0 || activeBlock) return;
        const scope = articleDepth > 0 ? 'article' : mainDepth > 0 ? 'main' : 'body';
        activeBlock = { tag: (el as unknown as { tagName?: string }).tagName?.toLowerCase() || 'p', buffer: '', scope };
        el.onEndTag(() => {
          pushActive();
        });
      },
      text(chunk) {
        if (ignoreDepth > 0 || !activeBlock) return;
        activeBlock.buffer += chunk.text;
      },
    });

  await rewriter.transform(response).arrayBuffer();

  if (robotsBlocked) {
    return { paragraphs: [], headingIndexes: [], unavailable: true };
  }
  if (paywallDetected) {
    return { paragraphs: [], headingIndexes: [], unavailable: true, blockedWall: true };
  }

  const chosen =
    articleBlocks.length >= 2 ? articleBlocks : mainBlocks.length >= 2 ? mainBlocks : bodyBlocks;

  const cleaned = cleanExtractedBlocks(chosen, { title: articleTitle });
  return { ...cleaned, ogImage };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return handlePagesApiRequest(context.request, context.env, {
    extractArticle: extractArticleWithHtmlRewriter,
  });
}
