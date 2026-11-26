import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceBackup, parseDeviceBackup } from './deviceBackup.ts';
import { DEFAULT_FEATURE_FLAGS, resolveFeatureFlags } from './featureFlags.ts';
import { safeStorageGet, safeStorageSet, STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION } from './storage.ts';
import { runStorageMigrations } from './storageMigrations.ts';

function createQuotaStorage(failFirstN = 0): {
  storage: Storage;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  let remainingFails = failFirstN;
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      if (remainingFails > 0) {
        remainingFails -= 1;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(key, String(value));
    },
  };
  return { storage, data };
}

describe('storage, migrations, backups, and featureFlags', () => {
  it('recovers cleanly from QuotaExceededError without crashing', () => {
    const { storage, data } = createQuotaStorage(1);
    data.set('opennews_feed_health', JSON.stringify({ huge: 'x'.repeat(200) }));
    data.set('opennews_recent_searches', JSON.stringify(['a', 'b']));

    const result = safeStorageSet('opennews_preferences', { theme: 'dark' }, storage);
    assert.equal(result.ok, true);
    assert.equal(result.recovered, true);
    assert.equal(result.quotaExceeded, true);
    assert.equal(data.has('opennews_feed_health'), false);
    assert.deepEqual(safeStorageGet('opennews_preferences', {}, storage), { theme: 'dark' });
  });

  it('handles permanent quota exhaustion gracefully without throwing', () => {
    const { storage } = createQuotaStorage(10);
    const result = safeStorageSet('opennews_preferences', { theme: 'dark' }, storage);
    assert.equal(result.ok, false);
    assert.equal(result.quotaExceeded, true);
  });

  it('runs v1 -> v2 storage migrations for AI aliases and plaintext web secrets', () => {
    const { storage: local } = createQuotaStorage(0);
    const { storage: session } = createQuotaStorage(0);
    local.setItem('opennews_ai_config', JSON.stringify({
      provider: 'google',
      model: 'gemini-2.5-flash',
      apiKey: 'AIzaSyOldPlainKey',
    }));

    const version = runStorageMigrations(local, session, { isNative: false });
    assert.equal(version, STORAGE_SCHEMA_VERSION);
    assert.equal(local.getItem(STORAGE_SCHEMA_KEY), String(STORAGE_SCHEMA_VERSION));
    assert.equal(session.getItem('opennews_web_secret_ai_api_key'), 'AIzaSyOldPlainKey');
    const migrated = JSON.parse(local.getItem('opennews_ai_config') || '{}') as { model: string; apiKey: string };
    assert.equal(migrated.model, 'gemini-flash-latest');
    assert.equal(migrated.apiKey, '');
  });

  it('preserves v1 backup compatibility and enforces 5 MB import limit', () => {
    const backup = createDeviceBackup(
      [{
        id: 'ts',
        name: 'Tagesschau',
        url: 'https://www.tagesschau.de/xml/rss2/',
        format: 'rss',
        category: 'Politik',
        description: '',
        language: 'de',
        region: 'DE',
        shortCode: 'TS',
        accentColor: '#003366',
        subscribed: true,
        tags: [],
      }],
      {
        likedIds: ['a1'],
        dislikedIds: [],
        bookmarkedIds: ['b1'],
        readIds: [],
        topicWeights: {},
        sourceWeights: {},
        keywordWeights: {},
        readingSecondsByTopic: {},
        readingSecondsBySource: {},
        totalReadingSeconds: 0,
      },
      {
        b1: {
          id: 'b1',
          sourceId: 'ts',
          sourceName: 'Tagesschau',
          sourceShortCode: 'TS',
          sourceColor: '#003366',
          title: 'Titel',
          summary: '',
          paragraphs: [],
          link: 'https://www.tagesschau.de/a1',
          category: 'Politik',
          publishedAt: '2026-11-26T10:00:00Z',
          readingTimeMin: 2,
          keywords: [],
        },
      },
    );

    const parsed = parseDeviceBackup(backup);
    assert.equal(parsed.sources.length, 1);
    assert.deepEqual(parsed.reactions.likedIds, ['a1']);
    assert.equal(parsed.bookmarks[0].id, 'b1');

    assert.throws(() => parseDeviceBackup('x'.repeat(5_000_001)), /5 MB/);
  });

  it('resolves feature flags with safe defaults enabled', () => {
    assert.deepEqual(resolveFeatureFlags(null), DEFAULT_FEATURE_FLAGS);
    const custom = resolveFeatureFlags({ liveRadio: false, clips: false });
    assert.equal(custom.liveRadio, false);
    assert.equal(custom.clips, false);
    assert.equal(custom.dailyBriefing, true);
  });
});
