import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TTS_CONFIG,
  ensureWavBytes,
  hasCloudTTS,
  normalizeTTSConfig,
  resolveEffectiveTTSApiKey,
  resolveScenarioTTS,
} from './ttsClient';
import { DEFAULT_AI_CONFIG } from './aiClient';

test('normalizeTTSConfig preserves defaults and handles unknown provider safely', () => {
  const fallback = normalizeTTSConfig({ provider: 'unknown' as never });
  assert.equal(fallback.provider, 'system');
  assert.equal(fallback.scenarios.article.speed, 1);

  const google = normalizeTTSConfig({ provider: 'google', apiKey: 'AIza-test' });
  assert.equal(google.provider, 'google');
  assert.equal(google.scenarios.article.model, 'gemini-3.8-flash-lite-tts');
  assert.equal(google.scenarios.briefing.model, 'gemini-3.8-flash-tts');
  assert.equal(google.scenarios.focus.voice, 'Charon');
});

test('resolveEffectiveTTSApiKey reuses main AI provider key when matching provider has blank TTS key', () => {
  const tts = normalizeTTSConfig({ provider: 'google', apiKey: '' });
  const ai = { ...DEFAULT_AI_CONFIG, provider: 'google' as const, apiKey: 'AIza-shared-key' };
  assert.equal(resolveEffectiveTTSApiKey(tts, ai), 'AIza-shared-key');
  assert.equal(hasCloudTTS(tts, ai), true);

  const openaiTts = normalizeTTSConfig({ provider: 'openai', apiKey: '' });
  assert.equal(resolveEffectiveTTSApiKey(openaiTts, ai), '');
  assert.equal(hasCloudTTS(openaiTts, ai), false);
});

test('resolveScenarioTTS applies per-scenario voice, model, speed, and clamps out-of-range speed', () => {
  const tts = normalizeTTSConfig({
    provider: 'google',
    apiKey: 'AIza-123',
    scenarios: {
      ...DEFAULT_TTS_CONFIG.scenarios,
      briefing: { model: 'gemini-3.8-flash-tts', voice: 'Puck', speed: 3.5, stylePrompt: 'Morning anchor' },
    },
  });
  const briefing = resolveScenarioTTS(tts, 'briefing');
  assert.equal(briefing.model, 'gemini-3.8-flash-tts');
  assert.equal(briefing.voice, 'Puck');
  assert.equal(briefing.speed, 1.6);
  assert.equal(briefing.stylePrompt, 'Morning anchor');
});

test('ensureWavBytes passes through existing RIFF WAVE untouched and wraps raw PCM cleanly', () => {
  const rawPcm = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const wrapped = ensureWavBytes(rawPcm, 24000);
  assert.equal(wrapped.length, 48);
  assert.equal(String.fromCharCode(wrapped[0], wrapped[1], wrapped[2], wrapped[3]), 'RIFF');
  assert.equal(String.fromCharCode(wrapped[8], wrapped[9], wrapped[10], wrapped[11]), 'WAVE');

  // Re-running on an already valid WAV must not double-wrap
  const passThrough = ensureWavBytes(wrapped, 24000);
  assert.equal(passThrough.length, 48);
  assert.equal(passThrough, wrapped);
});
