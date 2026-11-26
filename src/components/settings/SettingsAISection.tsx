import React, { useEffect, useState } from 'react';
import { Bot, Eye, EyeOff, KeyRound } from 'lucide-react';
import type { AIProviderConfig, AIProviderId } from '../../types/news';
import { AI_PROVIDERS, testAIConnection } from '../../lib/aiClient';
import { localAIAvailable } from '../../lib/localAI';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../../lib/summaryStyles';

interface SettingsAISectionProps {
  aiConfig: AIProviderConfig;
  onUpdateAIConfig: (config: AIProviderConfig) => void;
  onResetAlgorithm: () => void;
}

export const SettingsAISection: React.FC<SettingsAISectionProps> = ({
  aiConfig,
  onUpdateAIConfig,
  onResetAlgorithm,
}) => {
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

  return (
    <>
      <section className="settings-group space-y-3 p-4" aria-labelledby="personalization-heading">
        <h2 id="personalization-heading" className="font-semibold">Lokale Empfehlungen</h2>
        <p className="text-sm text-[var(--muted)]">
          Gelernte Gewichte halbieren sich alle 21 Tage. Beim Zurücksetzen bleiben Lesezeichen, Reaktionen und Verlauf erhalten.
        </p>
        <button type="button" className="choice-pill" onClick={onResetAlgorithm}>Algorithmus zurücksetzen</button>
      </section>

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
          <select
            className="preference-input"
            value={resolveSummaryStyle(aiConfig.summaryStyle)}
            onChange={event => onUpdateAIConfig({ ...aiConfig, summaryStyle: resolveSummaryStyle(event.target.value) })}
          >
            {Object.entries(SUMMARY_STYLES).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select>
        </label>
        {!deviceAvailable && <p className="text-sm">Gemini Nano ist hier derzeit nicht verfügbar.</p>}
        {!showAISetup && <button className="choice-pill" type="button" onClick={() => setShowAISetup(true)}>KI-Anbieter verbinden</button>}
        {showAISetup && (
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

            {aiConfig.provider !== 'device' && (
              <>
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
              </>
            )}

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
        )}
      </div>
    </>
  );
};
