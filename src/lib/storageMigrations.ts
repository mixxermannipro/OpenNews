import type { AIProviderConfig } from '../types/news';
import { migrateAIConfig } from './aiConfig';
import { STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION } from './storage';

function getLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Runs idempotent, versioned storage migrations once per schema bump.
 */
export function runStorageMigrations(
  local: Storage | null = getLocal(),
  session: Storage | null = getSession(),
  options: { isNative?: boolean } = {},
): number {
  if (!local) return STORAGE_SCHEMA_VERSION;
  let currentVersion = 0;
  try {
    const raw = local.getItem(STORAGE_SCHEMA_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) currentVersion = parsed;
    }
  } catch {
    return STORAGE_SCHEMA_VERSION;
  }

  if (currentVersion >= STORAGE_SCHEMA_VERSION) {
    return currentVersion;
  }

  // Migration v1: normalize legacy AI model aliases (e.g. gemini-2.5-flash -> gemini-flash-latest)
  if (currentVersion < 1) {
    try {
      const rawAi = local.getItem('opennews_ai_config');
      if (rawAi) {
        const parsed = JSON.parse(rawAi) as AIProviderConfig;
        const migrated = migrateAIConfig(parsed);
        local.setItem('opennews_ai_config', JSON.stringify(migrated));
      }
      local.setItem('opennews_ai_aliases_migrated', 'true');
    } catch {
      // Keep user data untouched if malformed
    }
  }

  // Migration v2: move plaintext web API keys from localStorage into sessionStorage unless persisted opt-in
  if (currentVersion < 2 && !options.isNative) {
    const persistOptIn = local.getItem('opennews_persist_web_keys') === 'true';
    for (const [configKey, secretName] of [
      ['opennews_ai_config', 'ai_api_key'],
      ['opennews_tts_config', 'tts_api_key'],
    ] as const) {
      try {
        const raw = local.getItem(configKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const apiKey = typeof parsed?.apiKey === 'string' ? parsed.apiKey.trim() : '';
        if (!apiKey) continue;
        session?.setItem(`opennews_web_secret_${secretName}`, apiKey);
        if (persistOptIn) {
          local.setItem(`opennews_web_secret_${secretName}`, apiKey);
        } else {
          local.setItem(configKey, JSON.stringify({ ...parsed, apiKey: '' }));
        }
      } catch {
        // Ignore malformed legacy config
      }
    }
  }

  try {
    local.setItem(STORAGE_SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION));
  } catch {
    // Ignore storage write restriction
  }
  return STORAGE_SCHEMA_VERSION;
}
