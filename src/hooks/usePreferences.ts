import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { DailyBriefingSettings } from '../lib/dailyBriefing';
import { DEFAULT_FEATURE_FLAGS, resolveFeatureFlags, type FeatureFlags } from '../lib/featureFlags';
import { resolveLanguage } from '../lib/i18n';
import {
  DEFAULT_PREFERENCES,
  resolveHomeTab,
  resolveRetention,
  type AppPreferences,
  type HomeTab,
} from '../lib/preferences';
import type { ThemeMode } from '../types/news';
import { useLocalStorage } from './useLocalStorage';

export function usePreferences() {
  const [storedPreferences, setPreferences] = useLocalStorage<AppPreferences>('opennews_preferences', DEFAULT_PREFERENCES);
  const preferences = useMemo<AppPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    ...(storedPreferences && typeof storedPreferences === 'object' ? storedPreferences : {}),
    topics: Array.isArray(storedPreferences?.topics) ? storedPreferences.topics : DEFAULT_PREFERENCES.topics,
  }), [storedPreferences]);

  const activeLanguage = useMemo(() => resolveLanguage(preferences.language), [preferences.language]);
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = preferences.motion;
    document.documentElement.lang = activeLanguage;
  }, [preferences.motion, activeLanguage]);

  const [homeCategory, setHomeCategory] = useState<HomeTab>(() => resolveHomeTab(preferences.home));
  const retention = resolveRetention(preferences.retention);
  const [onboarded, setOnboarded] = useLocalStorage('opennews_onboarded', false);
  const [autoTranslate, setAutoTranslate] = useLocalStorage('opennews_auto_translate', false);
  const [backgroundPlayback, setBackgroundPlayback] = useLocalStorage('opennews_background_playback', false);
  const [theme, setTheme] = useLocalStorage<ThemeMode>('opennews_theme', 'system');
  const [briefingSettings, setBriefingSettings] = useLocalStorage<DailyBriefingSettings>('opennews_daily_briefing', {
    enabled: false,
    time: '07:30',
  });
  const [storedFlags, setStoredFlags] = useLocalStorage<FeatureFlags>('opennews_feature_flags', DEFAULT_FEATURE_FLAGS);
  const featureFlags = useMemo(() => resolveFeatureFlags(storedFlags), [storedFlags]);

  const enableFullTextSource = useCallback((sourceId: string) => {
    if (!sourceId) return;
    setPreferences(prev => {
      const current = prev.fullTextSourceIds ?? [];
      return current.includes(sourceId) ? prev : { ...prev, fullTextSourceIds: [...current, sourceId] };
    });
  }, [setPreferences]);

  const disableFullTextSource = useCallback((sourceId: string) => {
    setPreferences(prev => ({
      ...prev,
      fullTextSourceIds: (prev.fullTextSourceIds ?? []).filter(id => id !== sourceId),
    }));
  }, [setPreferences]);

  return {
    preferences,
    setPreferences,
    activeLanguage,
    homeCategory,
    setHomeCategory,
    retention,
    onboarded,
    setOnboarded,
    autoTranslate,
    setAutoTranslate,
    backgroundPlayback,
    setBackgroundPlayback,
    theme,
    setTheme,
    briefingSettings,
    setBriefingSettings,
    featureFlags,
    setFeatureFlags: setStoredFlags,
    enableFullTextSource,
    disableFullTextSource,
  };
}
