import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv } from 'vite';

Object.assign(process.env, loadEnv('production', process.cwd(), 'VITE_'));

const { renderDocument } = await import('../src/document');
const { canonicalFor, routes } = await import('../src/content/meta');
const { isPreview, site } = await import('../src/content/site');
const paths = Object.keys(routes) as Array<keyof typeof routes>;
const output = 'dist';
const template = await readFile(join(output, 'index.html'), 'utf8');

for (const path of paths) {
  const directory = path === '/' || path === '/404' ? output : join(output, path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, path === '/404' ? '404.html' : 'index.html'), renderDocument(template, path));
}

const sitemap = isPreview ? [] : paths.flatMap(path => canonicalFor(path) ?? []);
const escapeXml = (url: string) => url.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
await writeFile(join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map(url => `  <url><loc>${escapeXml(url)}</loc></url>\n`).join('') + '</urlset>\n');
await writeFile(join(output, 'robots.txt'), 'User-agent: *\nAllow: /\n' +
  (isPreview ? '' : `Sitemap: ${site.url}/sitemap.xml\n`));
if (isPreview) {
  const headers = await readFile(join(output, '_headers'), 'utf8');
  await writeFile(join(output, '_headers'), headers.replace('/*\n', '/*\n  X-Robots-Tag: noindex, nofollow\n'));
}
