import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_LANGUAGES,
  formatRelativeTime,
  loadLanguageDictionary,
  resolveLanguage,
  translate,
  translateCategory,
  type TranslationKey,
} from './i18n';

test('all 6 supported languages load cleanly and define every translation key', async () => {
  const deDict = await loadLanguageDictionary('de');
  const deKeys = Object.keys(deDict) as TranslationKey[];
  assert.ok(deKeys.length > 100);
  assert.equal(APP_LANGUAGES.length, 6);

  for (const { code } of APP_LANGUAGES) {
    const dict = await loadLanguageDictionary(code);
    for (const key of deKeys) {
      assert.equal(typeof dict[key], 'string', `Missing key ${key} in ${code}`);
      assert.ok(dict[key].trim().length > 0, `Empty key ${key} in ${code}`);
    }
  }
});

test('resolveLanguage respects explicit selection and browser locales with de fallback', () => {
  assert.equal(resolveLanguage('en', 'de-DE'), 'en');
  assert.equal(resolveLanguage('fr', 'en-US'), 'fr');
  assert.equal(resolveLanguage('system', 'en-GB'), 'en');
  assert.equal(resolveLanguage('system', 'fr-CA'), 'fr');
  assert.equal(resolveLanguage('system', 'es-MX'), 'es');
  assert.equal(resolveLanguage('system', 'it-IT'), 'it');
  assert.equal(resolveLanguage('system', 'pt-BR'), 'pt');
  assert.equal(resolveLanguage('system', 'de-AT'), 'de');
  assert.equal(resolveLanguage('system', 'ja-JP'), 'de');
});

test('translate interpolates placeholders and translates categories across languages', async () => {
  await Promise.all(APP_LANGUAGES.map(lang => loadLanguageDictionary(lang.code)));
  assert.equal(translate('en', 'sourcesSelectedCounter', { count: 5 }), '5 active');
  assert.equal(translate('fr', 'sourcesSelectedCounter', { count: 3 }), '3 actives');
  assert.equal(translateCategory('en', 'Wirtschaft'), 'Business');
  assert.equal(translateCategory('es', 'Wissenschaft'), 'Ciencia');
  assert.equal(translateCategory('pt', 'Sport'), 'Desporto');
});

test('formatRelativeTime formats timestamps across languages', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
  const threeHoursAgo = new Date(now - 3 * 3_600_000).toISOString();

  assert.equal(formatRelativeTime(fiveMinAgo, 'de', now), 'vor 5 Min.');
  assert.equal(formatRelativeTime(fiveMinAgo, 'en', now), '5m ago');
  assert.equal(formatRelativeTime(fiveMinAgo, 'fr', now), 'il y a 5 min');
  assert.equal(formatRelativeTime(threeHoursAgo, 'es', now), 'hace 3 h');
  assert.equal(formatRelativeTime(threeHoursAgo, 'it', now), '3 h fa');
  assert.equal(formatRelativeTime(threeHoursAgo, 'pt', now), 'há 3 h');
});
