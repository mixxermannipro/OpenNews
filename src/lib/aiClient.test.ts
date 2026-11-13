import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, migrateAIConfig } from './aiClient';

test('Google offers moving aliases and migrates the previous Flash defaults', () => {
  assert.deepEqual(AI_PROVIDERS.find(provider => provider.id === 'google')?.models.map(model => model.id), [
    'gemini-flash-latest', 'gemini-flash-lite-latest',
  ]);
  assert.equal(DEFAULT_AI_CONFIG.model, 'gemini-flash-latest');
  assert.equal(migrateAIConfig({ ...DEFAULT_AI_CONFIG, model: 'gemini-2.5-flash-lite' }).model, 'gemini-flash-lite-latest');
  assert.equal(migrateAIConfig({ ...DEFAULT_AI_CONFIG, model: 'gemini-2.5-pro' }).model, 'gemini-2.5-pro');
  assert.equal(migrateAIConfig({ ...DEFAULT_AI_CONFIG, provider: 'custom', model: 'gemini-2.5-flash' }).model, 'gemini-2.5-flash');
});
