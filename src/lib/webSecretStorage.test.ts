import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWebKeyPersistenceEnabled,
  readWebSecret,
  setWebKeyPersistence,
  writeWebSecret,
} from './webSecretStorage.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('webSecretStorage', () => {
  it('stores keys in sessionStorage by default and keeps localStorage free of secrets', () => {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage();
    const origWindow = globalThis.window;
    (globalThis as unknown as { window: { sessionStorage: Storage; localStorage: Storage } }).window = {
      sessionStorage,
      localStorage,
    };

    try {
      assert.equal(isWebKeyPersistenceEnabled(), false);
      writeWebSecret('ai_api_key', 'AIzaSySessionOnly123');
      assert.equal(readWebSecret('ai_api_key'), 'AIzaSySessionOnly123');
      assert.equal(sessionStorage.getItem('opennews_web_secret_ai_api_key'), 'AIzaSySessionOnly123');
      assert.equal(localStorage.getItem('opennews_web_secret_ai_api_key'), null);

      // Opt-in to persistent browser storage
      setWebKeyPersistence(true, { aiKey: 'AIzaSySessionOnly123' });
      assert.equal(isWebKeyPersistenceEnabled(), true);
      assert.equal(localStorage.getItem('opennews_web_secret_ai_api_key'), 'AIzaSySessionOnly123');

      // Opt-out immediately clears localStorage while preserving sessionStorage
      setWebKeyPersistence(false);
      assert.equal(isWebKeyPersistenceEnabled(), false);
      assert.equal(localStorage.getItem('opennews_web_secret_ai_api_key'), null);
      assert.equal(readWebSecret('ai_api_key'), 'AIzaSySessionOnly123');
    } finally {
      (globalThis as unknown as { window: unknown }).window = origWindow;
    }
  });

  it('migrates legacy plaintext keys from opennews_ai_config into sessionStorage', () => {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage();
    localStorage.setItem('opennews_ai_config', JSON.stringify({ provider: 'google', apiKey: 'AIzaLegacyKey' }));
    const origWindow = globalThis.window;
    (globalThis as unknown as { window: { sessionStorage: Storage; localStorage: Storage } }).window = {
      sessionStorage,
      localStorage,
    };

    try {
      assert.equal(readWebSecret('ai_api_key'), 'AIzaLegacyKey');
      assert.equal(sessionStorage.getItem('opennews_web_secret_ai_api_key'), 'AIzaLegacyKey');
      const cleaned = JSON.parse(localStorage.getItem('opennews_ai_config') || '{}') as { apiKey?: string };
      assert.equal(cleaned.apiKey, '');
    } finally {
      (globalThis as unknown as { window: unknown }).window = origWindow;
    }
  });
});
