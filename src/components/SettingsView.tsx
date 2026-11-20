import { DailyBriefingSettings } from './DailyBriefingSettings';
import type { DailyBriefingSettings as BriefingSettings } from '../lib/dailyBriefing';
import { localAIAvailable } from '../lib/localAI';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../lib/summaryStyles';
import { Capacitor } from '@capacitor/core';
import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Radio,
  Rss,
  ArrowLeft,
} from 'lucide-react';
import type {
  AIProviderConfig,
  AIProviderId,
  FeedHealth,
  FormatPreferences,
  NewsCategory,
  NewsSource,
  NotificationSettings,
} from '../types/news';
import { AI_PROVIDERS, testAIConnection } from '../lib/aiClient';
import { TopicChoices } from './Preferences';
import { NewsPush } from '../lib/newsPush';
import { SourcesManager } from './SourcesManager';
import { useI18n } from '../lib/i18n';

export type SettingsSectionTab = 'overview' | 'feeds' | 'ai' | 'app';

interface SettingsViewProps {
  feedHealth: Record<string, FeedHealth>;
  initialSection?: SettingsSectionTab;
  sources: NewsSource[];
  formatPrefs: FormatPreferences;
  aiConfig: AIProviderConfig;
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
  onUpdateNotifications,
  onSendTestNotification,
  onResetAlgorithm,
  onBackHome,
  onAdvancedSources,
}) => {
  const { t } = useI18n();
  const section = initialSection;
  const [androidSettingsUnavailable, setAndroidSettingsUnavailable] = useState(false);
  const [showAISetup, setShowAISetup] = useState(Boolean(aiConfig.apiKey) || aiConfig.provider === 'device');
  const [showAIKey, setShowAIKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  const [deviceAvailable, setDeviceAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void localAIAvailable().then(value => { if (active) setDeviceAvailable(value); });
    return () => { active = false; };
  }, []);
  const activeProviderMeta =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];

  const handleProviderChange = (providerId: AIProviderId) => {
    const meta = AI_PROVIDERS.find((p) => p.id === providerId);
    onUpdateAIConfig({
      ...aiConfig,
      provider: providerId,
      apiKey: '',
      model: meta?.models[0]?.id || '',
    });
    setAiTestStatus(null);
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setAiTestStatus(null);
    const res = await testAIConnection(aiConfig);
    setAiTestStatus(res);
    setTestingAI(false);
  };

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
                <Layers className="h-4 w-4 text-slate-700 dark:text-slate-200" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Öffentliche Quellen
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Offene und frei nutzbare News-Quellen
                </p>
              </div>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
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
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
                        enabled ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
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
        <section className="settings-group space-y-3 p-4" aria-labelledby="personalization-heading">
          <h2 id="personalization-heading" className="font-semibold">Lokale Empfehlungen</h2>
          <p className="text-sm text-[var(--muted)]">
            Gelernte Gewichte halbieren sich alle 21 Tage. Beim Zurücksetzen bleiben Lesezeichen, Reaktionen und Verlauf erhalten.
          </p>
          <button type="button" className="choice-pill" onClick={onResetAlgorithm}>Algorithmus zurücksetzen</button>
        </section>
      )}
      {section === 'ai' && (
        <div className="liquid-glass rounded-[26px] p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Eigener KI-Anbieter (BYOK)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dein API-Key bleibt lokal auf deinem Smartphone
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">Empfohlen: lokale Zusammenfassungen ohne API-Schlüssel.</p>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Standardstil für KI-Zusammenfassungen
            <select className="preference-input" value={resolveSummaryStyle(aiConfig.summaryStyle)}
              onChange={event => onUpdateAIConfig({ ...aiConfig, summaryStyle: resolveSummaryStyle(event.target.value) })}>
              {Object.entries(SUMMARY_STYLES).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select>
          </label>
          {!deviceAvailable && <p className="text-sm">Gemini Nano ist hier derzeit nicht verfügbar.</p>}
          {!showAISetup && <button className="choice-pill" type="button" onClick={() => setShowAISetup(true)}>KI-Anbieter verbinden</button>}
          {showAISetup && <>
          <div className="space-y-4">
            <div>
              <label htmlFor="ai-provider" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                KI-Anbieter auswählen
              </label>
              <select
                id="ai-provider"
                value={aiConfig.provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
                className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 px-3.5 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
              >
                {AI_PROVIDERS.filter(provider => provider.id !== 'device' || deviceAvailable || aiConfig.provider === 'device').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {activeProviderMeta.docsHint}
              </p>
            </div>

            {aiConfig.provider !== 'device' && <>
            <div className="space-y-2">
              <label htmlFor="ai-model" className="block text-sm font-medium">Modell-ID</label>
              <input
                id="ai-model"
                value={aiConfig.model}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => {
                  onUpdateAIConfig({ ...aiConfig, model: e.target.value });
                  setAiTestStatus(null);
                }}
                className="preference-input w-full"
              />
              <div className="flex flex-wrap gap-2" aria-label="Modellvorschläge">
                {activeProviderMeta.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={aiConfig.model === model.id}
                    className="choice-pill"
                    onClick={() => {
                      onUpdateAIConfig({ ...aiConfig, model: model.id });
                      setAiTestStatus(null);
                    }}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            </div>

            {aiConfig.provider === 'custom' && (
              <div>
                <label htmlFor="ai-endpoint" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Custom Chat-Completions Endpunkt
                </label>
                <input
                  id="ai-endpoint"
                  type="url"
                  value={aiConfig.customEndpoint || ''}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, customEndpoint: e.target.value })
                  }
                  placeholder="https://openrouter.ai/api/v1/chat/completions"
                  className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 px-3.5 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                />
              </div>
            )}

            <div>
              <label htmlFor="ai-apikey" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                API-Key einfügen
              </label>
              <div className="relative flex items-center">
                <KeyRound className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-slate-400" />
                <input
                  id="ai-apikey"
                  type={showAIKey ? 'text' : 'password'}
                  value={aiConfig.apiKey}
                  onChange={(e) => onUpdateAIConfig({ ...aiConfig, apiKey: e.target.value })}
                  placeholder={activeProviderMeta.keyPlaceholder}
                  className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 pl-10 pr-12 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowAIKey((s) => !s)}
                  aria-label={showAIKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                  className="absolute right-0.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            </>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestAI}
                disabled={testingAI}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-xs font-semibold text-[var(--accent-ink)] transition hover:opacity-90 active:scale-95 disabled:opacity-60"
              >
                {testingAI ? 'Teste Verbindung…' : 'KI-Verbindung testen'}
              </button>
              {aiTestStatus && (
                <span
                  className={`text-xs font-semibold ${
                    aiTestStatus.ok ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {aiTestStatus.message}
                </span>
              )}
            </div>

            <div className="divide-y divide-black/5 border-t border-black/5 pt-3 dark:divide-white/10 dark:border-white/10">
              {[
                {
                  key: 'autoSummarize' as const,
                  label: 'Automatische KI-Zusammenfassung im Reader',
                },
              ].map((opt) => (
                <div key={opt.key} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {opt.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiConfig[opt.key]}
                    aria-label={opt.label}
                    onClick={() =>
                      onUpdateAIConfig({ ...aiConfig, [opt.key]: !aiConfig[opt.key] })
                    }
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                      aiConfig[opt.key] ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        aiConfig[opt.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </>}
        </div>
      )}

      {section === 'app' && (
        <div className="space-y-4">
          {Capacitor.getPlatform() === 'android' && <DailyBriefingSettings settings={briefingSettings} onChange={onBriefingSettings} />}
          <div className="liquid-glass rounded-[26px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Eilmeldungen &amp; Benachrichtigungen
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Capacitor.getPlatform() === 'android' ? 'Meldungen aus unterstützten Quellen auch bei geschlossener App.'
                      : 'Im Browser erscheinen Hinweise nur beim Aktualisieren in der geöffneten App.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifications.enabled}
                aria-label="Benachrichtigungen umschalten"
                disabled={requestingPushPermission}
                onClick={() => onUpdateNotifications({ ...notifications, enabled: !notifications.enabled })}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  notifications.enabled ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {(pushStatus || (pushPermissionDenied && androidSettingsUnavailable)) && (
              <p role="status" className="text-sm">{pushPermissionDenied && androidSettingsUnavailable
                ? 'Öffne in Android die App-Infos für OpenNews und wähle Benachrichtigungen.'
                : pushStatus}</p>
            )}
            {pushPermissionDenied && <button type="button" className="choice-pill"
              onClick={() => {
                setAndroidSettingsUnavailable(false);
                void NewsPush.openSettings().catch(() => setAndroidSettingsUnavailable(true));
              }}>
              Android-Einstellungen öffnen
            </button>}
            {notifications.enabled && (
              <div className="space-y-4 border-t border-black/10 pt-3 dark:border-white/10">
                <label className="preference-row px-0">
                  Nur als Eilmeldung markierte Artikel
                  <input type="checkbox" checked={notifications.breakingOnly}
                    onChange={event => onUpdateNotifications({ ...notifications, breakingOnly: event.target.checked })} />
                </label>
                {!notifications.breakingOnly && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Themen für Hinweise</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ohne Auswahl sind alle Themen aktiv.</p>
                    <TopicChoices topics={notifications.topics as NewsCategory[]}
                      onChange={topics => onUpdateNotifications({ ...notifications, topics })} />
                  </div>
                )}
                <fieldset className="flex flex-wrap gap-3">
                  <legend className="mb-2 text-sm font-semibold">Zeitfenster</legend>
                  <label className="flex items-center gap-2">Von <input type="time" className="preference-input"
                    value={notifications.from ?? '00:00'} onChange={event => onUpdateNotifications({ ...notifications, from: event.target.value || undefined })} /></label>
                  <label className="flex items-center gap-2">Bis <input type="time" className="preference-input"
                    value={notifications.until ?? '23:59'} onChange={event => onUpdateNotifications({ ...notifications, until: event.target.value || undefined })} /></label>
                </fieldset>
                <button type="button" onClick={onSendTestNotification} className="choice-pill">Lokale Test-Meldung anzeigen</button>
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
};
