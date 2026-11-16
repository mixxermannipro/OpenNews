import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function readSite(env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import { site, isPreview } from './src/content/site.ts'; console.log(JSON.stringify({ site, isPreview }));",
  ], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
}

test('default configuration is a preview without a placeholder URL or store link', () => {
  const result = readSite();
  assert.equal(result.status, 0, result.stderr);
  const { site, isPreview } = JSON.parse(result.stdout);
  assert.equal(isPreview, true);
  assert.equal(site.url, null);
  assert.equal(site.playStoreUrl, null);
});

test('production needs confirmed details and accepts the official app package only', () => {
  const env = {
    VITE_SITE_STATUS: 'live',
    VITE_SITE_URL: 'https://example.com',
    VITE_OPERATOR_NAME: 'Test',
    VITE_OPERATOR_STREET: 'Teststraße 1',
    VITE_OPERATOR_POSTAL_CODE: '00000',
    VITE_OPERATOR_CITY: 'Teststadt',
    VITE_OPERATOR_COUNTRY: 'Testland',
    VITE_CONTACT_EMAIL: 'test@example.com',
    VITE_WEBSITE_PRIVACY_NOTICE: 'Test',
    VITE_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=io.opennews.app',
  };
  assert.match(readSite(env).stderr, /Für den Live-Build fehlen/);
  const result = readSite({ ...env, VITE_RELEASE_APPROVED: 'yes' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).isPreview, false);
  assert.match(readSite({ VITE_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=example' }).stderr, /io.opennews.app/);
});
