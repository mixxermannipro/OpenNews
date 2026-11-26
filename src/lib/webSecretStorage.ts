import { isSecureSecretsSupported } from './secureSecrets';

export type WebSecretKeyName = 'ai_api_key' | 'tts_api_key';

const PERSIST_FLAG_KEY = 'opennews_persist_web_keys';
const STORAGE_PREFIX = 'opennews_web_secret_';

function getSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function getLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isWebKeyPersistenceEnabled(): boolean {
  if (isSecureSecretsSupported()) return false;
  try {
    return getLocal()?.getItem(PERSIST_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function readWebSecret(name: WebSecretKeyName): string {
  if (isSecureSecretsSupported()) return '';
  const session = getSession();
  const local = getLocal();
  const key = `${STORAGE_PREFIX}${name}`;

  try {
    const fromSession = session?.getItem(key)?.trim();
    if (fromSession) return fromSession;

    const fromLocal = local?.getItem(key)?.trim();
    if (fromLocal) {
      session?.setItem(key, fromLocal);
      if (!isWebKeyPersistenceEnabled()) {
        local?.removeItem(key);
      }
      return fromLocal;
    }

    // Legacy migration: migrate any plaintext key from opennews_ai_config / opennews_tts_config
    const legacyConfigKey = name === 'ai_api_key' ? 'opennews_ai_config' : 'opennews_tts_config';
    const rawConfig = local?.getItem(legacyConfigKey);
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig) as { apiKey?: unknown };
      const legacyKey = typeof parsed?.apiKey === 'string' ? parsed.apiKey.trim() : '';
      if (legacyKey) {
        session?.setItem(key, legacyKey);
        if (isWebKeyPersistenceEnabled()) {
          local?.setItem(key, legacyKey);
        }
        // Strip legacy plaintext key from config JSON in localStorage
        const scrubbed = { ...parsed, apiKey: '' };
        local?.setItem(legacyConfigKey, JSON.stringify(scrubbed));
        return legacyKey;
      }
    }
  } catch {
    // Ignore storage restrictions cleanly
  }
  return '';
}

export function writeWebSecret(name: WebSecretKeyName, value: string, persist = isWebKeyPersistenceEnabled()): void {
  if (isSecureSecretsSupported()) return;
  const session = getSession();
  const local = getLocal();
  const key = `${STORAGE_PREFIX}${name}`;
  const trimmed = value.trim();

  try {
    if (trimmed) {
      session?.setItem(key, trimmed);
      if (persist) {
        local?.setItem(key, trimmed);
      } else {
        local?.removeItem(key);
      }
    } else {
      session?.removeItem(key);
      local?.removeItem(key);
    }
  } catch {
    // Ignore storage quota or private-mode restrictions cleanly
  }
}

function scrubConfigKeyInLocal(storageKey: string): void {
  const local = getLocal();
  if (!local) return;
  try {
    const raw = local.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && typeof parsed.apiKey === 'string' && parsed.apiKey) {
      local.setItem(storageKey, JSON.stringify({ ...parsed, apiKey: '' }));
    }
  } catch {
    // Ignore malformed entries
  }
}

export function setWebKeyPersistence(
  persist: boolean,
  currentKeys: { aiKey?: string; ttsKey?: string } = {},
): void {
  if (isSecureSecretsSupported()) return;
  const local = getLocal();
  try {
    if (persist) {
      local?.setItem(PERSIST_FLAG_KEY, 'true');
      if (currentKeys.aiKey?.trim()) writeWebSecret('ai_api_key', currentKeys.aiKey, true);
      if (currentKeys.ttsKey?.trim()) writeWebSecret('tts_api_key', currentKeys.ttsKey, true);
    } else {
      local?.removeItem(PERSIST_FLAG_KEY);
      local?.removeItem(`${STORAGE_PREFIX}ai_api_key`);
      local?.removeItem(`${STORAGE_PREFIX}tts_api_key`);
      scrubConfigKeyInLocal('opennews_ai_config');
      scrubConfigKeyInLocal('opennews_tts_config');
    }
  } catch {
    // Ignore storage restrictions
  }
}
