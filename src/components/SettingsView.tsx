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
  Volume2,
} from 'lucide-react';
import type {
  AIProviderConfig,
  AIProviderId,
  FeedHealth,
  FormatPreferences,
  NewsCategory,
  NewsSource,
  NotificationSettings,
  TTSProviderConfig,
  TTSProviderId,
  TTSScenarioId,
} from '../types/news';
import { AI_PROVIDERS, testAIConnection } from '../lib/aiClient';
import {
  buildProviderDefaults,
  getTTSProviderMeta,
  getTTSSampleText,
  normalizeTTSConfig,
  resolveEffectiveTTSApiKey,
  synthesizeSpeechBlob,
  TTS_PROVIDERS,
} from '../lib/ttsClient';
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
  onUpdateNotifications,
  onSendTestNotification,
  onResetAlgorithm,
  onBackHome,
  onAdvancedSources,
}) => {
  const { lang, locale, t } = useI18n();
  const section = initialSection;
  const [androidSettingsUnavailable, setAndroidSettingsUnavailable] = useState(false);
  const [showAISetup, setShowAISetup] = useState(Boolean(aiConfig.apiKey) || aiConfig.provider === 'device');
  const [showAIKey, setShowAIKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  const normalizedTTS = normalizeTTSConfig(ttsConfig);
  const activeTTSMeta = getTTSProviderMeta(normalizedTTS.provider);
  const [ttsScenario, setTtsScenario] = useState<TTSScenarioId>('article');
  const [showTTSKey, setShowTTSKey] = useState(false);
  const [testingTTS, setTestingTTS] = useState(false);
  const [ttsTestStatus, setTtsTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const [deviceAvailable, setDeviceAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void localAIAvailable().then(value => { if (active) setDeviceAvailable(value); });
    return () => { active = false; };
  }, []);
  const activeProviderMeta =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];

  const handleTTSProviderChange = (providerId: TTSProviderId) => {
    const defaults = buildProviderDefaults(providerId);
    onUpdateTTSConfig({
      ...normalizedTTS,
      provider: providerId,
      apiKey: '',
      model: defaults.model,
      voice: defaults.voice,
      scenarios: defaults.scenarios,
    });
    setTtsTestStatus(null);
  };

  const handleUpdateScenario = (updates: { model?: string; voice?: string; speed?: number }) => {
    const nextScenarios = {
      ...normalizedTTS.scenarios,
      [ttsScenario]: {
        ...normalizedTTS.scenarios[ttsScenario],
        ...updates,
      },
    };
    onUpdateTTSConfig({
      ...normalizedTTS,
      ...(ttsScenario === 'article' && updates.model ? { model: updates.model } : {}),
      ...(ttsScenario === 'article' && updates.voice ? { voice: updates.voice } : {}),
      scenarios: nextScenarios,
    });
    setTtsTestStatus(null);
  };

  const handleTestTTS = async () => {
    setTestingTTS(true);
    setTtsTestStatus(null);
    const sample = getTTSSampleText(lang, ttsScenario);
    try {
      if (normalizedTTS.provider === 'system') {
        if (!('speechSynthesis' in window)) {
          setTtsTestStatus({ ok: false, message: 'Systemstimme wird in diesem Browser nicht unterstützt.' });
          return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sample);
        u.lang = locale;
        u.rate = normalizedTTS.scenarios[ttsScenario]?.speed ?? 1;
        window.speechSynthesis.speak(u);
        setTtsTestStatus({ ok: true, message: 'Systemstimme spielt Beispiel ab.' });
        return;
      }
      const blob = await synthesizeSpeechBlob(sample, ttsScenario, normalizedTTS, aiConfig, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
      setTtsTestStatus({ ok: true, message: `${activeTTSMeta.name} spielt Beispiel ab.` });
    } catch (err) {
      setTtsTestStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Stimm-Test fehlgeschlagen.',
      });
    } finally {
      setTestingTTS(false);
    }
  };

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
              <h2 className="text-base font-bold text-[var(--ink)]">
                Eigener KI-Anbieter (BYOK)
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Dein API-Key bleibt lokal auf deinem Smartphone
              </p>
            </div>
          </div>

          <p className="text-sm text-[var(--muted)]">Empfohlen: lokale Zusammenfassungen ohne API-Schlüssel.</p>
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
              <label htmlFor="ai-provider" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                KI-Anbieter auswählen
              </label>
              <select
                id="ai-provider"
                value={aiConfig.provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
                className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-sm font-medium text-[var(--ink)]"
              >
                {AI_PROVIDERS.filter(provider => provider.id !== 'device' || deviceAvailable || aiConfig.provider === 'device').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
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
                <label htmlFor="ai-endpoint" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
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
                  className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-sm text-[var(--ink)]"
                />
              </div>
            )}

            <div>
              <label htmlFor="ai-apikey" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                API-Key einfügen
              </label>
              <div className="relative flex items-center">
                <KeyRound className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-[var(--muted)]" />
                <input
                  id="ai-apikey"
                  type={showAIKey ? 'text' : 'password'}
                  value={aiConfig.apiKey}
                  onChange={(e) => onUpdateAIConfig({ ...aiConfig, apiKey: e.target.value })}
                  placeholder={activeProviderMeta.keyPlaceholder}
                  className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] pl-10 pr-12 text-sm text-[var(--ink)]"
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

            <div className="divide-y divide-[var(--line)] border-t border-[var(--line)] pt-3">
              {[
                {
                  key: 'autoSummarize' as const,
                  label: 'Automatische KI-Zusammenfassung im Reader',
                },
              ].map((opt) => (
                <div key={opt.key} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-[var(--ink)]">
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
                      aiConfig[opt.key] ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[var(--control)] ring-1 ring-inset ring-[var(--line)]'
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

      {/* SECTION 3B: MULTI-PROVIDER SCENARIO TTS */}
      {section === 'ai' && (
        <div className="liquid-glass rounded-[26px] p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--control)] text-[var(--accent)]">
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">{t('ttsTitle')}</h2>
              <p className="text-xs text-[var(--muted)]">{t('ttsSubtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="tts-provider" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                {t('ttsProviderLabel')}
              </label>
              <select
                id="tts-provider"
                value={normalizedTTS.provider}
                onChange={e => handleTTSProviderChange(e.target.value as TTSProviderId)}
                className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-sm font-medium text-[var(--ink)]"
              >
                {TTS_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">{activeTTSMeta.freeTierHint}</p>
            </div>

            {normalizedTTS.provider !== 'system' && (
              <>
                {/* Scenario Selector */}
                <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
                  <div
                    role="group"
                    aria-label={t('ttsTitle')}
                    className="segmented-control sliding-tabs"
                    style={{
                      '--tab-count': 3,
                      '--tab-index': (['article', 'briefing', 'focus'] as const).indexOf(ttsScenario),
                    } as React.CSSProperties}
                  >
                    <span className="tab-track" aria-hidden="true"><span className="tab-selection" /></span>
                    {([
                      { id: 'article', label: t('ttsScenarioArticle') },
                      { id: 'briefing', label: t('ttsScenarioBriefing') },
                      { id: 'focus', label: t('ttsScenarioFocus') },
                    ] as const).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={ttsScenario === item.id}
                        onClick={() => setTtsScenario(item.id)}
                        className="choice-pill whitespace-nowrap text-xs"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="tts-scenario-model" className="block text-xs font-semibold text-[var(--muted)]">
                      {t('ttsModelLabel')}
                    </label>
                    <select
                      id="tts-scenario-model"
                      value={normalizedTTS.scenarios[ttsScenario]?.model || normalizedTTS.model}
                      onChange={e => handleUpdateScenario({ model: e.target.value })}
                      className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-sm text-[var(--ink)]"
                    >
                      {activeTTSMeta.models.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-[var(--muted)]">{t('ttsVoiceLabel')}</span>
                    <div className="flex flex-wrap gap-2">
                      {activeTTSMeta.voices.map(voice => {
                        const activeVoice = (normalizedTTS.scenarios[ttsScenario]?.voice || normalizedTTS.voice) === voice.id;
                        return (
                          <button
                            key={voice.id}
                            type="button"
                            aria-pressed={activeVoice}
                            className="choice-pill text-xs"
                            onClick={() => handleUpdateScenario({ voice: voice.id })}
                          >
                            {voice.label} · <span className="opacity-70">{voice.tone}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {normalizedTTS.provider === 'custom' && (
                  <div>
                    <label htmlFor="tts-endpoint" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                      Custom TTS HTTPS Endpunkt
                    </label>
                    <input
                      id="tts-endpoint"
                      type="url"
                      value={normalizedTTS.customEndpoint || ''}
                      onChange={e => onUpdateTTSConfig({ ...normalizedTTS, customEndpoint: e.target.value })}
                      placeholder="https://api.groq.com/openai/v1/audio/speech"
                      className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-sm text-[var(--ink)]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="tts-apikey" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                    API-Key
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-[var(--muted)]" />
                    <input
                      id="tts-apikey"
                      type={showTTSKey ? 'text' : 'password'}
                      value={normalizedTTS.apiKey}
                      onChange={e => onUpdateTTSConfig({ ...normalizedTTS, apiKey: e.target.value })}
                      placeholder={activeTTSMeta.keyPlaceholder}
                      className="w-full min-h-[44px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] pl-10 pr-12 text-sm text-[var(--ink)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTTSKey(s => !s)}
                      aria-label={showTTSKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                      className="absolute right-0.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      {showTTSKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {(normalizedTTS.provider === 'google' || normalizedTTS.provider === 'openai') && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {t('ttsUseMainKeyHint')}
                      {!normalizedTTS.apiKey.trim() && resolveEffectiveTTSApiKey(normalizedTTS, aiConfig)
                        ? ' ✓'
                        : ''}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => void handleTestTTS()}
                disabled={testingTTS}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-xs font-semibold text-[var(--accent-ink)] transition hover:opacity-90 active:scale-95 disabled:opacity-60"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                {testingTTS ? t('ttsTesting') : t('ttsTestVoice')}
              </button>
              {ttsTestStatus && (
                <span className={`text-xs font-semibold ${ttsTestStatus.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {ttsTestStatus.message}
                </span>
              )}
            </div>
          </div>
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
                  <h2 className="text-sm font-semibold text-[var(--ink)]">
                    Eilmeldungen &amp; Benachrichtigungen
                  </h2>
                  <p className="text-xs text-[var(--muted)]">
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
                  notifications.enabled ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[var(--control)] ring-1 ring-inset ring-[var(--line)]'
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
              <div className="space-y-4 border-t border-[var(--line)] pt-3">
                <label className="preference-row px-0">
                  Nur als Eilmeldung markierte Artikel
                  <input type="checkbox" checked={notifications.breakingOnly}
                    onChange={event => onUpdateNotifications({ ...notifications, breakingOnly: event.target.checked })} />
                </label>
                {!notifications.breakingOnly && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Themen für Hinweise</p>
                    <p className="text-sm text-[var(--muted)]">Ohne Auswahl sind alle Themen aktiv.</p>
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
