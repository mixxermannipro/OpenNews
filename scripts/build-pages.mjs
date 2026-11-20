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
const appHeaders = `
/app/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; media-src 'self' https: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'self'; connect-src 'self' https:; worker-src 'self' blob:
`;
writeFileSync(headersPath, `${existingHeaders.trimEnd()}\n${appHeaders}`);

const redirectsPath = join(outDir, '_redirects');
const existingRedirects = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
writeFileSync(redirectsPath, `${existingRedirects.trimEnd()}\n/app /app/ 301\n`);

console.log('Cloudflare Pages bundle built at dist-pages/');
