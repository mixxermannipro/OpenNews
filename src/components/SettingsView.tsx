import { DailyBriefingSettings } from './DailyBriefingSettings';
import type { DailyBriefingSettings as BriefingSettings } from '../lib/dailyBriefing';
import { Capacitor } from '@capacitor/core';
import React from 'react';
import {
  Database,
  Layers,
  Radio,
  Rss,
  ArrowLeft,
} from 'lucide-react';
import type {
  AIProviderConfig,
  FeedHealth,
  FormatPreferences,
  NewsSource,
  NotificationSettings,
  TTSProviderConfig,
} from '../types/news';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../lib/featureFlags';
import { SourcesManager } from './SourcesManager';
import { useI18n } from '../lib/i18n';
import { getSettingsCopy } from '../lib/settingsCopy';
import { SettingsFeatureFlagsCard } from './settings/SettingsFeatureFlagsCard';
import { SettingsAISection } from './settings/SettingsAISection';
import { SettingsTTSSection } from './settings/SettingsTTSSection';
import { SettingsNotificationsSection } from './settings/SettingsNotificationsSection';

export type SettingsSectionTab = 'overview' | 'feeds' | 'ai' | 'app';

interface SettingsViewProps {
  feedHealth: Record<string, FeedHealth>;
  initialSection?: SettingsSectionTab;
  sources: NewsSource[];
  formatPrefs: FormatPreferences;
  aiConfig: AIProviderConfig;
  ttsConfig: TTSProviderConfig;
  notifications: NotificationSettings;
  briefingSettings: BriefingSettings;
  onBriefingSettings: (value: BriefingSettings) => void;
  pushStatus: string;
  pushPermissionDenied: boolean;
  requestingPushPermission: boolean;
  onImportSources: (sources: NewsSource[]) => void;
  onToggleSource: (sourceId: string) => void;
  onSetSourceSubscriptions: (ids: string[], subscribed: boolean) => void;
  onAddCustomSource: (source: NewsSource) => void;
  onUpdateSource: (sourceId: string, updates: Partial<NewsSource>) => void;
  onRemoveCustomSource: (sourceId: string) => void;
  onUpdateFormatPrefs: (prefs: FormatPreferences) => void;
  onUpdateAIConfig: (config: AIProviderConfig) => void;
  onUpdateTTSConfig: (config: TTSProviderConfig) => void;
  persistWebKeys?: boolean;
  onTogglePersistWebKeys?: (persist: boolean) => void;
  featureFlags?: FeatureFlags;
  onUpdateFeatureFlags?: (next: FeatureFlags) => void;
  onUpdateNotifications: (next: NotificationSettings) => void;
  onSendTestNotification: () => void;
  onResetAlgorithm: () => void;
  onBackHome: () => void;
  onAdvancedSources: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  feedHealth,
  initialSection = 'overview',
  sources,
  formatPrefs,
  aiConfig,
  ttsConfig,
  notifications,
  briefingSettings,
  onBriefingSettings,
  pushStatus,
  pushPermissionDenied,
  requestingPushPermission,
  onImportSources,
  onToggleSource,
  onSetSourceSubscriptions,
  onAddCustomSource,
  onUpdateSource,
  onRemoveCustomSource,
  onUpdateFormatPrefs,
  onUpdateAIConfig,
  onUpdateTTSConfig,
  persistWebKeys = false,
  onTogglePersistWebKeys,
  featureFlags = DEFAULT_FEATURE_FLAGS,
  onUpdateFeatureFlags,
  onUpdateNotifications,
  onSendTestNotification,
  onResetAlgorithm,
  onBackHome,
  onAdvancedSources,
}) => {
  const { lang, t } = useI18n();
  const section = initialSection;

  const sectionTitles: Record<SettingsSectionTab, string> = {
    overview: t('settingsFormatsTitle'),
    feeds: t('sourcesTitle'),
    ai: t('settingsAI'),
    app: t('settingsNotifications'),
  };

  return (
    <section
      key={section}
      className={section === 'feeds' ? 'screen-entry settings-page settings-page-wide' : 'screen-entry settings-page'}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="screen-title">{sectionTitles[section]}</h1>
          {section === 'feeds' && <p className="screen-subtitle">{t('sourcesSubtitle')}</p>}
        </div>

        <button
          type="button"
          onClick={onBackHome}
          aria-label={t('back')}
          className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--ink)] transition hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          {/* Card 1: Öffentliche Quellen */}
          <div className="liquid-glass rounded-[26px] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="liquid-glass-subtle flex h-10 w-10 items-center justify-center rounded-full">
                <Layers className="h-4 w-4 text-[var(--ink)]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">
                  Öffentliche Quellen
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Offene und frei nutzbare News-Quellen
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {[
                {
                  key: 'rssAtom' as const,
                  label: 'RSS/Atom',
                  desc: 'News-Feeds im Standardformat',
                  iconBg: 'bg-amber-500/15 text-amber-500',
                  icon: <Rss className="h-4 w-4" />,
                },
                {
                  key: 'jsonFeed' as const,
                  label: 'JSON Feed',
                  desc: 'Moderne, strukturierte Feeds',
                  iconBg: 'bg-indigo-500/15 text-indigo-500',
                  icon: <span className="text-xs font-bold">{'{}'}</span>,
                },
                {
                  key: 'openData' as const,
                  label: 'Open Data',
                  desc: 'Öffentliche Datenquellen (z. B. EU, Bund, Länder)',
                  iconBg: 'bg-blue-500/15 text-blue-500',
                  icon: <Database className="h-4 w-4" />,
                },
                {
                  key: 'podcasts' as const,
                  label: 'Podcasts',
                  desc: 'News- und Hintergrundformate als Audio',
                  iconBg: 'bg-purple-500/15 text-purple-500',
                  icon: <Radio className="h-4 w-4" />,
                },
              ].map((item) => {
                const enabled = formatPrefs[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {item.label}
                        </p>
                        <p className="text-xs text-[var(--muted)] truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${item.label} umschalten`}
                      onClick={() =>
                        onUpdateFormatPrefs({ ...formatPrefs, [item.key]: !enabled })
                      }
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[var(--control)] ring-1 ring-inset ring-[var(--line)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {onUpdateFeatureFlags && (
            <SettingsFeatureFlagsCard
              featureFlags={featureFlags}
              onUpdateFeatureFlags={onUpdateFeatureFlags}
            />
          )}

        </div>
      )}

      {/* SECTION 2: REDESIGNED SOURCES MANAGER */}
      {section === 'feeds' && (
        <SourcesManager
          sources={sources}
          feedHealth={feedHealth}
          onToggleSource={onToggleSource}
          onSetSourceSubscriptions={onSetSourceSubscriptions}
          onAddCustomSource={onAddCustomSource}
          onUpdateSource={onUpdateSource}
          onRemoveCustomSource={onRemoveCustomSource}
          onImportSources={onImportSources}
          onAdvancedSources={onAdvancedSources}
        />
      )}

      {/* SECTION 3: KI & API-KEY */}
      {section === 'ai' && (
        <>
          <SettingsAISection
            aiConfig={aiConfig}
            onUpdateAIConfig={onUpdateAIConfig}
            onResetAlgorithm={onResetAlgorithm}
          />
          <SettingsTTSSection
            ttsConfig={ttsConfig}
            aiConfig={aiConfig}
            onUpdateTTSConfig={onUpdateTTSConfig}
          />
        </>
      )}

      {section === 'ai' && !Capacitor.isNativePlatform() && onTogglePersistWebKeys && (
        <div className="liquid-glass rounded-[26px] p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[var(--ink)]">{getSettingsCopy(lang).webKeysPersistLabel}</h2>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                {getSettingsCopy(lang).webKeysPersistHelp}
              </p>
              {!persistWebKeys && (
                <p className="text-xs font-medium text-[var(--accent)]">
                  {getSettingsCopy(lang).webKeysSessionActive}
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={persistWebKeys}
              aria-label={getSettingsCopy(lang).webKeysPersistLabel}
              onClick={() => onTogglePersistWebKeys(!persistWebKeys)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                persistWebKeys ? 'bg-amber-600 dark:bg-amber-500' : 'bg-[var(--control)] ring-1 ring-inset ring-[var(--line)]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  persistWebKeys ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {section === 'app' && (
        <div className="space-y-4">
          {Capacitor.getPlatform() === 'android' && <DailyBriefingSettings settings={briefingSettings} onChange={onBriefingSettings} />}
          <SettingsNotificationsSection
            notifications={notifications}
            pushStatus={pushStatus}
            pushPermissionDenied={pushPermissionDenied}
            requestingPushPermission={requestingPushPermission}
            onUpdateNotifications={onUpdateNotifications}
            onSendTestNotification={onSendTestNotification}
          />
          {onUpdateFeatureFlags && (
            <SettingsFeatureFlagsCard
              featureFlags={featureFlags}
              onUpdateFeatureFlags={onUpdateFeatureFlags}
            />
          )}
        </div>
      )}
    </section>
  );
};
