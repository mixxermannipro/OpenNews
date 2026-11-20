import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const websiteDir = join(root, 'apps', 'website');
const outDir = join(root, 'dist-pages');

if (!existsSync(join(websiteDir, 'node_modules'))) {
  execSync('npm --prefix apps/website ci', { stdio: 'inherit' });
}

execSync('npm --prefix apps/website run build', { stdio: 'inherit' });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(websiteDir, 'dist'), outDir, { recursive: true });

execSync('npx vite build --outDir dist-pages/app', {
  stdio: 'inherit',
  env: { ...process.env, VITE_APP_BASE: '/app/' },
});

const headersPath = join(outDir, '_headers');
const existingHeaders = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';
const websiteCspMatch = existingHeaders.match(/^\s*Content-Security-Policy:.*$/m);
const websiteCspLine = websiteCspMatch
  ? websiteCspMatch[0]
  : "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const baseHeaders = existingHeaders.replace(/^\s*Content-Security-Policy:.*\n?/m, '').trimEnd();

const websiteRoutesCsp = ['/', '/datenschutz/*', '/impressum/*', '/kontakt/*', '/404.html']
  .map((route) => `${route}\n${websiteCspLine}`)
  .join('\n\n');

const appHeaders = `
${websiteRoutesCsp}

/app/*
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; media-src 'self' https: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'self'; connect-src 'self' https:; worker-src 'self' blob:
`;
writeFileSync(headersPath, `${baseHeaders}\n${appHeaders}`);

const redirectsPath = join(outDir, '_redirects');
const existingRedirects = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
writeFileSync(redirectsPath, `${existingRedirects.trimEnd()}\n/app /app/ 301\n`);

console.log('Cloudflare Pages bundle built at dist-pages/');
