import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('prerendered pages and social assets exist', () => {
  const home = readFileSync('dist/index.html', 'utf8');
  assert.match(home, /<h1>Deine Nachrichten\./);
  assert.match(home, /property="og:title"/);
  assert.doesNotMatch(home, /<!--site-(head|body)-->/);
  for (const file of ['404.html', 'datenschutz/index.html', 'impressum/index.html', 'kontakt/index.html']) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    assert.match(html, /<main id="inhalt"/);
    assert.match(html, /<h1>/);
  }
  assert.ok(readFileSync('dist/og/opennews.jpg').length > 0);
  assert.match(readFileSync('dist/_redirects', 'utf8'), /^\/privacy \/datenschutz\/ 301/m);
  assert.match(readFileSync('dist/datenschutz/index.html', 'utf8'), /English – Privacy Policy/);
  assert.match(readFileSync('dist/datenschutz/index.html', 'utf8'), /io\.opennews\.app/);
  const robots = readFileSync('dist/robots.txt', 'utf8');
  const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
  if (home.includes('content="noindex, nofollow"')) {
    assert.match(readFileSync('dist/_headers', 'utf8'), /X-Robots-Tag: noindex/);
    assert.doesNotMatch(robots, /Sitemap:/);
    assert.doesNotMatch(sitemap, /<loc>/);
  } else {
    assert.match(robots, /Sitemap: https:\/\//);
    assert.match(sitemap, /<loc>https:\/\//);
    assert.match(home, /application\/ld\+json/);
  }
});
