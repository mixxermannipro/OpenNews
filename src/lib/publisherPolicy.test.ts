import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPaywallMarkup,
  hasRobotsNoArchiveOrNoAi,
  isPublisherOptedOut,
} from './publisherPolicy.ts';

describe('publisherPolicy', () => {
  it('matches publisher opt-out domains and subdomains', () => {
    assert.equal(isPublisherOptedOut('https://news.example.de/artikel/1', 'example.de'), true);
    assert.equal(isPublisherOptedOut('https://www.example.de/artikel/1', 'example.de'), true);
    assert.equal(isPublisherOptedOut('https://other-example.de/artikel/1', 'example.de'), false);
    assert.equal(isPublisherOptedOut('not-a-url', 'example.de'), false);
  });

  it('detects noarchive and noai in headers and HTML meta tags', () => {
    assert.equal(
      hasRobotsNoArchiveOrNoAi(new Headers({ 'X-Robots-Tag': 'noindex, noarchive' }), '<html></html>'),
      true,
    );
    assert.equal(
      hasRobotsNoArchiveOrNoAi(null, '<html><head><meta name="robots" content="index, noai"></head></html>'),
      true,
    );
    assert.equal(
      hasRobotsNoArchiveOrNoAi(null, '<html><head><meta content="noimageai" name="googlebot"></head></html>'),
      true,
    );
    assert.equal(
      hasRobotsNoArchiveOrNoAi(new Headers({ 'X-Robots-Tag': 'index, follow' }), '<html><head><meta name="robots" content="index, follow"></head></html>'),
      false,
    );
  });

  it('detects JSON-LD, microdata, and meta paywall markers', () => {
    assert.equal(
      hasPaywallMarkup('<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>'),
      true,
    );
    assert.equal(
      hasPaywallMarkup('<meta itemprop="isAccessibleForFree" content="False">'),
      true,
    );
    assert.equal(
      hasPaywallMarkup('<meta property="article:content_tier" content="locked">'),
      true,
    );
    assert.equal(
      hasPaywallMarkup('<div data-paywall-state="locked">Bitte abonnieren</div>'),
      true,
    );
    assert.equal(
      hasPaywallMarkup('<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":true}</script><p>Freier Artikel</p>'),
      false,
    );
  });
});
