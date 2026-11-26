import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Volume2 } from 'lucide-react';
import type { AIProviderConfig, TTSProviderConfig, TTSProviderId, TTSScenarioId } from '../../types/news';
import {
  buildProviderDefaults,
  getTTSProviderMeta,
  getTTSSampleText,
  normalizeTTSConfig,
  resolveEffectiveTTSApiKey,
  synthesizeSpeechBlob,
  TTS_PROVIDERS,
} from '../../lib/ttsClient';
import { useI18n } from '../../lib/i18n';
import { getSettingsCopy } from '../../lib/settingsCopy';

interface SettingsTTSSectionProps {
  ttsConfig: TTSProviderConfig;
  aiConfig: AIProviderConfig;
  onUpdateTTSConfig: (config: TTSProviderConfig) => void;
}

export const SettingsTTSSection: React.FC<SettingsTTSSectionProps> = ({
  ttsConfig,
  aiConfig,
  onUpdateTTSConfig,
}) => {
  const { lang, locale, t } = useI18n();
  const normalizedTTS = normalizeTTSConfig(ttsConfig);
  const activeTTSMeta = getTTSProviderMeta(normalizedTTS.provider);
  const [ttsScenario, setTtsScenario] = useState<TTSScenarioId>('article');
  const [showTTSKey, setShowTTSKey] = useState(false);
  const [testingTTS, setTestingTTS] = useState(false);
  const [ttsTestStatus, setTtsTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

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
    const copy = getSettingsCopy(lang);
    setTestingTTS(true);
    setTtsTestStatus(null);
    const sample = getTTSSampleText(lang, ttsScenario);
    try {
      if (normalizedTTS.provider === 'system') {
        if (!('speechSynthesis' in window)) {
          setTtsTestStatus({ ok: false, message: copy.ttsSystemUnsupported });
          return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sample);
        u.lang = locale;
        u.rate = normalizedTTS.scenarios[ttsScenario]?.speed ?? 1;
        window.speechSynthesis.speak(u);
        setTtsTestStatus({ ok: true, message: copy.ttsSystemPlaying });
        return;
      }
      const blob = await synthesizeSpeechBlob(sample, ttsScenario, normalizedTTS, aiConfig, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
      setTtsTestStatus({ ok: true, message: copy.ttsProviderPlaying(activeTTSMeta.name) });
    } catch (err) {
      setTtsTestStatus({
        ok: false,
        message: err instanceof Error ? err.message : copy.ttsTestFailed,
      });
    } finally {
      setTestingTTS(false);
    }
  };

  return (
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
  );
};
