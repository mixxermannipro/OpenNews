import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AI_CONFIG, migrateAIConfig } from '../lib/aiConfig';
import {
  isWebKeyPersistenceEnabled,
  readWebSecret,
  setWebKeyPersistence,
  writeWebSecret,
} from '../lib/webSecretStorage';
import type { AIProviderConfig, TTSProviderConfig } from '../types/news';
import { useLocalStorage } from './useLocalStorage';

const INITIAL_TTS_CONFIG: TTSProviderConfig = {
  provider: 'system',
  apiKey: '',
  model: 'system',
  voice: 'default',
  customEndpoint: '',
  scenarios: {
    article: { model: 'system', voice: 'default', speed: 1 },
    briefing: { model: 'system', voice: 'default', speed: 1.05 },
    focus: { model: 'system', voice: 'default', speed: 0.92 },
  },
};

export function useAIConfig() {
  const [storedAIConfig, setAiConfig] = useLocalStorage<AIProviderConfig>('opennews_ai_config', DEFAULT_AI_CONFIG);
  const [aiConfigMigrated, setAIConfigMigrated] = useLocalStorage('opennews_ai_aliases_migrated', false);
  const [androidAIKey, setAndroidAIKey] = useState('');
  const [androidTTSKey, setAndroidTTSKey] = useState('');
  const [storedTTSConfig, setStoredTTSConfig] = useLocalStorage<TTSProviderConfig>(
    'opennews_tts_config',
    INITIAL_TTS_CONFIG,
  );
  const isAndroidPlatform = Capacitor.getPlatform() === 'android';
  const [persistWebKeys, setPersistWebKeys] = useState<boolean>(() => isWebKeyPersistenceEnabled());
  const [webAIKey, setWebAIKey] = useState<string>(() => (isAndroidPlatform ? '' : readWebSecret('ai_api_key')));
  const [webTTSKey, setWebTTSKey] = useState<string>(() => (isAndroidPlatform ? '' : readWebSecret('tts_api_key')));

  useEffect(() => {
    if (!isAndroidPlatform) return;
    let active = true;
    void import('../lib/secureSecrets').then(async ({ getSecureSecret, setSecureSecret }) => {
      const legacyAI = storedAIConfig.apiKey?.trim() || '';
      const legacyTTS = storedTTSConfig.apiKey?.trim() || '';
      const storedAI = (await getSecureSecret('ai_api_key')) ?? '';
      const storedTTS = (await getSecureSecret('tts_api_key')) ?? '';

      let finalAI = storedAI;
      if (!finalAI && legacyAI) {
        if (await setSecureSecret('ai_api_key', legacyAI)) {
          finalAI = legacyAI;
          setAiConfig(prev => ({ ...prev, apiKey: '' }));
        }
      } else if (storedAI && legacyAI) {
        setAiConfig(prev => ({ ...prev, apiKey: '' }));
      }

      let finalTTS = storedTTS;
      if (!finalTTS && legacyTTS) {
        if (await setSecureSecret('tts_api_key', legacyTTS)) {
          finalTTS = legacyTTS;
          setStoredTTSConfig(prev => ({ ...prev, apiKey: '' }));
        }
      } else if (storedTTS && legacyTTS) {
        setStoredTTSConfig(prev => ({ ...prev, apiKey: '' }));
      }

      if (active) {
        if (finalAI) setAndroidAIKey(finalAI);
        if (finalTTS) setAndroidTTSKey(finalTTS);
      }
    }).catch(() => {});
    return () => { active = false; };
  // Intentionally runs on mount to hydrate/migrate Keystore secrets on Android
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aiConfig = useMemo(() => {
    const base = aiConfigMigrated ? storedAIConfig : migrateAIConfig(storedAIConfig);
    if (isAndroidPlatform && androidAIKey && !base.apiKey) {
      return { ...base, apiKey: androidAIKey };
    }
    if (!isAndroidPlatform && webAIKey && !base.apiKey) {
      return { ...base, apiKey: webAIKey };
    }
    return base;
  }, [storedAIConfig, aiConfigMigrated, isAndroidPlatform, androidAIKey, webAIKey]);

  const updateAIConfig = useCallback((next: AIProviderConfig) => {
    const trimmedKey = next.apiKey.trim();
    if (isAndroidPlatform) {
      setAndroidAIKey(trimmedKey);
      void import('../lib/secureSecrets').then(async ({ removeSecureSecret, setSecureSecret }) => {
        if (trimmedKey) {
          const ok = await setSecureSecret('ai_api_key', trimmedKey);
          if (ok) {
            setAiConfig({ ...next, apiKey: '' });
            return;
          }
        } else {
          await removeSecureSecret('ai_api_key');
        }
        setAiConfig({ ...next, apiKey: '' });
      }).catch(() => setAiConfig(next));
    } else {
      setWebAIKey(trimmedKey);
      writeWebSecret('ai_api_key', trimmedKey, persistWebKeys);
      setAiConfig(persistWebKeys ? { ...next, apiKey: trimmedKey } : { ...next, apiKey: '' });
    }
    setAIConfigMigrated(true);
  }, [isAndroidPlatform, persistWebKeys, setAiConfig, setAIConfigMigrated]);

  const ttsConfig = useMemo(() => {
    if (isAndroidPlatform && androidTTSKey && !storedTTSConfig.apiKey) {
      return { ...storedTTSConfig, apiKey: androidTTSKey };
    }
    if (!isAndroidPlatform && webTTSKey && !storedTTSConfig.apiKey) {
      return { ...storedTTSConfig, apiKey: webTTSKey };
    }
    return storedTTSConfig;
  }, [storedTTSConfig, isAndroidPlatform, androidTTSKey, webTTSKey]);

  const updateTTSConfig = useCallback((next: TTSProviderConfig) => {
    const trimmedKey = next.apiKey.trim();
    if (isAndroidPlatform) {
      setAndroidTTSKey(trimmedKey);
      void import('../lib/secureSecrets').then(async ({ removeSecureSecret, setSecureSecret }) => {
        if (trimmedKey) {
          const ok = await setSecureSecret('tts_api_key', trimmedKey);
          if (ok) {
            setStoredTTSConfig({ ...next, apiKey: '' });
            return;
          }
        } else {
          await removeSecureSecret('tts_api_key');
        }
        setStoredTTSConfig({ ...next, apiKey: '' });
      }).catch(() => setStoredTTSConfig(next));
    } else {
      setWebTTSKey(trimmedKey);
      writeWebSecret('tts_api_key', trimmedKey, persistWebKeys);
      setStoredTTSConfig(persistWebKeys ? { ...next, apiKey: trimmedKey } : { ...next, apiKey: '' });
    }
  }, [isAndroidPlatform, persistWebKeys, setStoredTTSConfig]);

  const togglePersistWebKeys = useCallback((persist: boolean) => {
    setPersistWebKeys(persist);
    setWebKeyPersistence(persist, { aiKey: webAIKey, ttsKey: webTTSKey });
    setAiConfig(prev => ({ ...prev, apiKey: persist ? webAIKey : '' }));
    setStoredTTSConfig(prev => ({ ...prev, apiKey: persist ? webTTSKey : '' }));
  }, [webAIKey, webTTSKey, setAiConfig, setStoredTTSConfig]);

  return {
    aiConfig,
    ttsConfig,
    persistWebKeys,
    updateAIConfig,
    updateTTSConfig,
    togglePersistWebKeys,
  };
}
