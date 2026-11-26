import { clearAIResults } from './aiCache';

export const STORAGE_SCHEMA_KEY = 'opennews_storage_schema';
export const STORAGE_SCHEMA_VERSION = 2;
export const STORAGE_QUOTA_EVENT = 'opennews:storage-quota';

function getLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError'
    || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || e.code === 22
    || e.code === 1014
  );
}

/**
 * Frees space in localStorage and IndexedDB caches when storage quota is reached,
 * preserving user subscriptions, bookmarks, and profile settings.
 */
export function recoverStorageSpace(storage: Storage | null = getLocal()): boolean {
  let freed = false;
  if (storage) {
    for (const expendableKey of [
      'opennews_feed_health',
      'opennews_recent_searches',
      'opennews_diagnostics',
      'opennews_diagnostics_reports',
    ]) {
      try {
        if (storage.getItem(expendableKey) !== null) {
          storage.removeItem(expendableKey);
          freed = true;
        }
      } catch {
        // Ignore individual removal failures
      }
    }
    try {
      const rawRead = storage.getItem('opennews_read_articles');
      if (rawRead) {
        const parsed = JSON.parse(rawRead);
        if (Array.isArray(parsed) && parsed.length > 15) {
          storage.setItem('opennews_read_articles', JSON.stringify(parsed.slice(0, 15)));
          freed = true;
        }
      }
    } catch {
      try {
        storage.removeItem('opennews_read_articles');
        freed = true;
      } catch {
        // Ignore
      }
    }
  }

  if (typeof indexedDB !== 'undefined') {
    void clearAIResults().catch(() => {});
  }
  return freed;
}

function notifyQuotaWarning(): void {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_EVENT));
  } catch {
    // Ignore in restricted environments
  }
}

export function safeStorageGet<T>(key: string, fallback: T, storage: Storage | null = getLocal()): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeStorageSet(
  key: string,
  value: unknown,
  storage: Storage | null = getLocal(),
): { ok: boolean; recovered: boolean; quotaExceeded: boolean } {
  if (!storage) return { ok: false, recovered: false, quotaExceeded: false };
  const serialized = JSON.stringify(value);
  try {
    storage.setItem(key, serialized);
    return { ok: true, recovered: false, quotaExceeded: false };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      return { ok: false, recovered: false, quotaExceeded: false };
    }
    recoverStorageSpace(storage);
    notifyQuotaWarning();
    try {
      storage.setItem(key, serialized);
      return { ok: true, recovered: true, quotaExceeded: true };
    } catch {
      return { ok: false, recovered: false, quotaExceeded: true };
    }
  }
}
