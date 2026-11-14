import assert from 'node:assert/strict';
import test from 'node:test';
import { aiCacheKey, isFreshAIResult, withAIResult } from './aiCache';
import { DEFAULT_AI_CONFIG } from './aiClient';

test('cache keys track the data and model but exclude credentials', async () => {
  const config = { ...DEFAULT_AI_CONFIG, apiKey: 'dummy' };
  const key = await aiCacheKey(config, 'summary', ['article-1'], 'Inhalt');
  assert.equal(key, await aiCacheKey({ ...config, apiKey: 'other' }, 'summary', ['article-1'], 'Inhalt'));
  assert.notEqual(key, await aiCacheKey(config, 'summary', ['article-2'], 'Inhalt'));
  assert.notEqual(key, await aiCacheKey(config, 'summary', ['article-1'], 'Neuer Inhalt'));
  assert.notEqual(key, await aiCacheKey({ ...config, model: 'other' }, 'summary', ['article-1'], 'Inhalt'));
  assert.doesNotMatch(key, /dummy|Inhalt/);
});

test('cached results expire at the configured cutoff', () => {
  const day = 86_400_000;
  assert.equal(isFreshAIResult({ created: day }, '4', 5 * day - 1), true);
  assert.equal(isFreshAIResult({ created: day }, '4', 5 * day), false);
});

test('simultaneous identical requests share the provider call', async () => {
  let runs = 0;
  const load = async () => ++runs;
  const params = [DEFAULT_AI_CONFIG, 'test', ['a'], 'example', load] as const;
  assert.deepEqual(await Promise.all([withAIResult(...params), withAIResult(...params)]), [1, 1]);
  assert.equal(runs, 1);
});
