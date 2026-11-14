import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { extractArticle } from './articleExtraction';

test('finds editorial text outside an article element and returns plain text', () => {
  const detail = 'Die Redaktion beschreibt die neuen Entwicklungen und ordnet die Folgen für die Region ausführlich ein.';
  const dom = new JSDOM(`<head><meta property="og:image" content="/photo.jpg"></head>
    <body><nav>Navigationsmenü</nav><main><div class="article-body"><h1>Nachrichten</h1>
    <p>${detail.repeat(6)}</p><h2>Was folgt</h2><p>${detail.repeat(4)}</p>
    <script>throw new Error('This must never execute')</script></div></main></body>`,
  { url: 'https://example.org/news' });
  const result = extractArticle(dom.window.document, dom.window.location.href);
  assert.equal(result.ogImage, 'https://example.org/photo.jpg');
  assert.ok(result.paragraphs.some(text => text.includes(detail)));
  assert.ok(result.paragraphs.every(text => !text.includes('Navigationsmenü') && !text.includes('never execute')));
  assert.ok(result.headingIndexes.some(index => result.paragraphs[index] === 'Was folgt'));
  dom.window.close();
});
