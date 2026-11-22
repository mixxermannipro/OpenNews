import { Capacitor } from '@capacitor/core';
import type {
  AIProviderConfig,
  AppLanguage,
  TTSProviderConfig,
  TTSProviderId,
  TTSScenarioId,
} from '../types/news';

export interface TTSVoiceOption {
  id: string;
  label: string;
  tone: string;
}

export interface TTSProviderMeta {
  id: TTSProviderId;
  name: string;
  freeTierHint: string;
  keyPlaceholder: string;
  models: Array<{ id: string; label: string }>;
  voices: TTSVoiceOption[];
}

export interface TTSScenarioMeta {
  id: TTSScenarioId;
  defaultSpeed: number;
  defaultStylePrompt: string;
  recommendedGoogleModel: string;
  recommendedGoogleVoice: string;
  recommendedOpenAIVoice: string;
  recommendedElevenVoice: string;
}

export const TTS_PROVIDERS: TTSProviderMeta[] = [
  {
    id: 'system',
    name: 'Systemstimme (Lokal & kostenlos)',
    freeTierHint: 'Nutzt direkt die Stimme deines Geräts — 100 % offline, ohne API-Key.',
    keyPlaceholder: '',
    models: [{ id: 'system', label: 'Gerätestimme' }],
    voices: [{ id: 'default', label: 'Standard', tone: 'System' }],
  },
  {
    id: 'google',
    name: 'Google AI Studio (Gemini TTS)',
    freeTierHint: 'Kostenloser API-Key aus Google AI Studio (aistudio.google.com). Nutzt optional deinen Gemini-Key von oben.',
    keyPlaceholder: 'AIzaSy... (oder leer für Google-Key von oben)',
    models: [
      { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite TTS (Schnell & Artikel)' },
      { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS (Expressiv & Briefing)' },
    ],
    voices: [
      { id: 'Kore', label: 'Kore', tone: 'Sachlich & klar' },
      { id: 'Puck', label: 'Puck', tone: 'Lebendig & modern' },
      { id: 'Charon', label: 'Charon', tone: 'Ruhig & tief' },
      { id: 'Fenrir', label: 'Fenrir', tone: 'Markant & dynamisch' },
      { id: 'Zephyr', label: 'Zephyr', tone: 'Warm & entspannt' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI Speech',
    freeTierHint: 'API-Key aus platform.openai.com. Nutzt optional deinen OpenAI-Key von oben.',
    keyPlaceholder: 'sk-proj-... (oder leer für OpenAI-Key von oben)',
    models: [
      { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS (Steuerbarer Stil)' },
      { id: 'tts-1', label: 'TTS-1 (Schnell & sparsam)' },
      { id: 'tts-1-hd', label: 'TTS-1 HD (Studioqualität)' },
    ],
    voices: [
      { id: 'sage', label: 'Sage', tone: 'Redaktionell & ruhig' },
      { id: 'nova', label: 'Nova', tone: 'Klar & freundlich' },
      { id: 'onyx', label: 'Onyx', tone: 'Tief & seriös' },
      { id: 'alloy', label: 'Alloy', tone: 'Ausgewogen' },
      { id: 'shimmer', label: 'Shimmer', tone: 'Sanft & warm' },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    freeTierHint: 'Kostenloses Kontingent (10.000 Zeichen/Monat) auf elevenlabs.io.',
    keyPlaceholder: 'sk_...',
    models: [
      { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (Niedrige Latenz, 32 Sprachen)' },
      { id: 'eleven_multilingual_v2', label: 'Multilingual v2 (Sehr natürlich)' },
    ],
    voices: [
      { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', tone: 'Ruhig & klar' },
      { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel', tone: 'Nachrichtensprecher' },
      { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah', tone: 'Warm & natürlich' },
      { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', tone: 'Markant & tief' },
    ],
  },
  {
    id: 'custom',
    name: 'OpenAI-kompatibler TTS-Endpunkt',
    freeTierHint: 'Für eigene HTTPS-Endpunkte (z. B. Groq PlayAI, Kokoro-FastAPI).',
    keyPlaceholder: 'API-Key (optional)',
    models: [
      { id: 'playai-tts', label: 'PlayAI TTS (Groq)' },
      { id: 'kokoro', label: 'Kokoro TTS (Open Source)' },
    ],
    voices: [
      { id: 'alloy', label: 'Alloy / Standard', tone: 'Standard' },
      { id: 'Fritz-PlayAI', label: 'Fritz (PlayAI)', tone: 'Klar' },
    ],
  },
];

export const TTS_SCENARIOS: Record<TTSScenarioId, TTSScenarioMeta> = {
  article: {
    id: 'article',
    defaultSpeed: 1,
    defaultStylePrompt: 'Clear, calm, articulate editorial newsreader with natural pacing.',
    recommendedGoogleModel: 'gemini-3.8-flash-lite-tts',
    recommendedGoogleVoice: 'Kore',
    recommendedOpenAIVoice: 'sage',
    recommendedElevenVoice: '21m00Tcm4TlvDq8ikWAM',
  },
  briefing: {
    id: 'briefing',
    defaultSpeed: 1.05,
    defaultStylePrompt: 'Crisp, engaging morning radio news anchor delivering a daily briefing.',
    recommendedGoogleModel: 'gemini-3.8-flash-tts',
    recommendedGoogleVoice: 'Puck',
    recommendedOpenAIVoice: 'nova',
    recommendedElevenVoice: 'onwK4e9ZLuTAKqWW03F9',
  },
  focus: {
    id: 'focus',
    defaultSpeed: 0.92,
    defaultStylePrompt: 'Warm, relaxed, unhurried evening narrator for calm longform reading.',
    recommendedGoogleModel: 'gemini-3.8-flash-lite-tts',
    recommendedGoogleVoice: 'Charon',
    recommendedOpenAIVoice: 'onyx',
    recommendedElevenVoice: 'EXAVITQu4vr4xnSDxMaL',
  },
};

export const DEFAULT_TTS_CONFIG: TTSProviderConfig = {
  provider: 'system',
  apiKey: '',
  model: 'gemini-3.8-flash-lite-tts',
  voice: 'Kore',
  customEndpoint: '',
  scenarios: {
    article: {
      model: 'gemini-3.8-flash-lite-tts',
      voice: 'Kore',
      speed: 1,
      stylePrompt: TTS_SCENARIOS.article.defaultStylePrompt,
    },
    briefing: {
      model: 'gemini-3.8-flash-tts',
      voice: 'Puck',
      speed: 1.05,
      stylePrompt: TTS_SCENARIOS.briefing.defaultStylePrompt,
    },
    focus: {
      model: 'gemini-3.8-flash-lite-tts',
      voice: 'Charon',
      speed: 0.92,
      stylePrompt: TTS_SCENARIOS.focus.defaultStylePrompt,
    },
  },
};

export function getTTSProviderMeta(provider: TTSProviderId): TTSProviderMeta {
  return TTS_PROVIDERS.find(p => p.id === provider) ?? TTS_PROVIDERS[0];
}

export function buildProviderDefaults(provider: TTSProviderId): Pick<TTSProviderConfig, 'model' | 'voice' | 'scenarios'> {
  const meta = getTTSProviderMeta(provider);
  const baseModel = meta.models[0]?.id ?? 'system';
  const baseVoice = meta.voices[0]?.id ?? 'default';

  if (provider === 'google') {
    return {
      model: 'gemini-3.8-flash-lite-tts',
      voice: 'Kore',
      scenarios: {
        article: { model: 'gemini-3.8-flash-lite-tts', voice: 'Kore', speed: 1, stylePrompt: TTS_SCENARIOS.article.defaultStylePrompt },
        briefing: { model: 'gemini-3.8-flash-tts', voice: 'Puck', speed: 1.05, stylePrompt: TTS_SCENARIOS.briefing.defaultStylePrompt },
        focus: { model: 'gemini-3.8-flash-lite-tts', voice: 'Charon', speed: 0.92, stylePrompt: TTS_SCENARIOS.focus.defaultStylePrompt },
      },
    };
  }
  if (provider === 'openai') {
    return {
      model: 'gpt-4o-mini-tts',
      voice: 'sage',
      scenarios: {
        article: { model: 'gpt-4o-mini-tts', voice: 'sage', speed: 1, stylePrompt: TTS_SCENARIOS.article.defaultStylePrompt },
        briefing: { model: 'gpt-4o-mini-tts', voice: 'nova', speed: 1.05, stylePrompt: TTS_SCENARIOS.briefing.defaultStylePrompt },
        focus: { model: 'tts-1-hd', voice: 'onyx', speed: 0.92, stylePrompt: TTS_SCENARIOS.focus.defaultStylePrompt },
      },
    };
  }
  if (provider === 'elevenlabs') {
    return {
      model: 'eleven_flash_v2_5',
      voice: '21m00Tcm4TlvDq8ikWAM',
      scenarios: {
        article: { model: 'eleven_flash_v2_5', voice: '21m00Tcm4TlvDq8ikWAM', speed: 1, stylePrompt: TTS_SCENARIOS.article.defaultStylePrompt },
        briefing: { model: 'eleven_flash_v2_5', voice: 'onwK4e9ZLuTAKqWW03F9', speed: 1.05, stylePrompt: TTS_SCENARIOS.briefing.defaultStylePrompt },
        focus: { model: 'eleven_multilingual_v2', voice: 'EXAVITQu4vr4xnSDxMaL', speed: 0.92, stylePrompt: TTS_SCENARIOS.focus.defaultStylePrompt },
      },
    };
  }
  return {
    model: baseModel,
    voice: baseVoice,
    scenarios: {
      article: { model: baseModel, voice: baseVoice, speed: 1, stylePrompt: TTS_SCENARIOS.article.defaultStylePrompt },
      briefing: { model: baseModel, voice: baseVoice, speed: 1.05, stylePrompt: TTS_SCENARIOS.briefing.defaultStylePrompt },
      focus: { model: baseModel, voice: baseVoice, speed: 0.92, stylePrompt: TTS_SCENARIOS.focus.defaultStylePrompt },
    },
  };
}

export function normalizeTTSConfig(raw?: Partial<TTSProviderConfig> | null): TTSProviderConfig {
  const provider: TTSProviderId =
    raw?.provider && ['system', 'google', 'openai', 'elevenlabs', 'custom'].includes(raw.provider)
      ? raw.provider
      : 'system';
  const defaults = buildProviderDefaults(provider);
  return {
    provider,
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
    model: typeof raw?.model === 'string' && raw.model.trim() ? raw.model.trim() : defaults.model,
    voice: typeof raw?.voice === 'string' && raw.voice.trim() ? raw.voice.trim() : defaults.voice,
    customEndpoint: typeof raw?.customEndpoint === 'string' ? raw.customEndpoint : '',
    scenarios: {
      article: { ...defaults.scenarios.article, ...(raw?.scenarios?.article ?? {}) },
      briefing: { ...defaults.scenarios.briefing, ...(raw?.scenarios?.briefing ?? {}) },
      focus: { ...defaults.scenarios.focus, ...(raw?.scenarios?.focus ?? {}) },
    },
  };
}

export function resolveEffectiveTTSApiKey(ttsConfig: TTSProviderConfig, aiConfig?: AIProviderConfig): string {
  const direct = ttsConfig.apiKey.trim();
  if (direct) return direct;
  if (aiConfig && aiConfig.apiKey.trim()) {
    if (ttsConfig.provider === 'google' && aiConfig.provider === 'google') return aiConfig.apiKey.trim();
    if (ttsConfig.provider === 'openai' && aiConfig.provider === 'openai') return aiConfig.apiKey.trim();
  }
  return '';
}

export function hasCloudTTS(ttsConfig: TTSProviderConfig, aiConfig?: AIProviderConfig): boolean {
  if (ttsConfig.provider === 'system') return false;
  if (ttsConfig.provider === 'custom') return Boolean(ttsConfig.customEndpoint?.trim());
  return Boolean(resolveEffectiveTTSApiKey(ttsConfig, aiConfig));
}

export interface ResolvedScenarioTTS {
  provider: TTSProviderId;
  model: string;
  voice: string;
  speed: number;
  stylePrompt: string;
  apiKey: string;
  customEndpoint?: string;
}

export function resolveScenarioTTS(
  ttsConfig: TTSProviderConfig,
  scenario: TTSScenarioId,
  aiConfig?: AIProviderConfig,
): ResolvedScenarioTTS {
  const norm = normalizeTTSConfig(ttsConfig);
  const sc = norm.scenarios[scenario] ?? {};
  const meta = TTS_SCENARIOS[scenario];
  return {
    provider: norm.provider,
    model: (sc.model || norm.model).trim(),
    voice: (sc.voice || norm.voice).trim(),
    speed: typeof sc.speed === 'number' && Number.isFinite(sc.speed) ? Math.max(0.75, Math.min(1.6, sc.speed)) : meta.defaultSpeed,
    stylePrompt: (sc.stylePrompt || meta.defaultStylePrompt).trim(),
    apiKey: resolveEffectiveTTSApiKey(norm, aiConfig),
    customEndpoint: norm.customEndpoint?.trim() || undefined,
  };
}

/**
 * Ensures Gemini TTS bytes are playable WAV: passes through RIFF/WAV unchanged,
 * or prepends a standard 44-byte RIFF header if raw 24kHz 16-bit mono PCM is returned.
 */
export function ensureWavBytes(bytes: Uint8Array, sampleRate = 24000): Uint8Array {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45    // E
  ) {
    return bytes;
  }
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + bytes.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, bytes.length, true);

  const out = new Uint8Array(44 + bytes.length);
  out.set(new Uint8Array(header), 0);
  out.set(bytes, 44);
  return out;
}

const MAX_AUDIO_CACHE = 24;
const audioBlobCache = new Map<string, Blob>();
const inflightClips = new Map<string, Promise<Blob>>();

function clipCacheKey(resolved: ResolvedScenarioTTS, text: string, lang: AppLanguage): string {
  return `${resolved.provider}|${resolved.model}|${resolved.voice}|${resolved.stylePrompt}|${lang}|${text}`;
}

function storeInAudioCache(key: string, blob: Blob): void {
  if (audioBlobCache.has(key)) audioBlobCache.delete(key);
  audioBlobCache.set(key, blob);
  while (audioBlobCache.size > MAX_AUDIO_CACHE) {
    const oldest = audioBlobCache.keys().next().value;
    if (oldest !== undefined) audioBlobCache.delete(oldest);
    else break;
  }
}

export function clearTTSAudioCache(): void {
  audioBlobCache.clear();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Synthesizes speech via the configured cloud TTS provider (proxied on web, direct on native).
 */
export async function synthesizeSpeechBlob(
  rawText: string,
  scenario: TTSScenarioId,
  ttsConfig: TTSProviderConfig,
  aiConfig: AIProviderConfig | undefined,
  lang: AppLanguage,
  signal?: AbortSignal,
): Promise<Blob> {
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 2800);
  if (!text) throw new Error('Kein Text zum Vorlesen vorhanden.');

  const resolved = resolveScenarioTTS(ttsConfig, scenario, aiConfig);
  if (resolved.provider === 'system') {
    throw new Error('Systemstimme benötigt keinen Cloud-Abruf.');
  }
  if (!resolved.apiKey && resolved.provider !== 'custom') {
    throw new Error('Bitte hinterlege einen API-Key für den gewählten Vorlese-Anbieter.');
  }

  const key = clipCacheKey(resolved, text, lang);
  const cached = audioBlobCache.get(key);
  if (cached) return cached;

  const existingPromise = inflightClips.get(key);
  if (existingPromise) return existingPromise;

  const task = (async () => {
    // Web/dev mode: route through server /api/tts/proxy for Google SDK, CORS & security
    if (!Capacitor.isNativePlatform()) {
      const resp = await fetch('/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          provider: resolved.provider,
          apiKey: resolved.apiKey,
          model: resolved.model,
          voice: resolved.voice,
          stylePrompt: resolved.stylePrompt,
          speed: resolved.speed,
          language: lang,
          customEndpoint: resolved.customEndpoint,
          text,
        }),
      });
      if (!resp.ok) {
        const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Vorlese-Anfrage fehlgeschlagen (${resp.status})`);
      }
      const blob = await resp.blob();
      if (!blob.size) throw new Error('Leere Audio-Antwort erhalten.');
      storeInAudioCache(key, blob);
      return blob;
    }

    // Native Capacitor fallback (direct HTTPS call from device)
    if (resolved.provider === 'google') {
      const model = resolved.model.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': resolved.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: resolved.stylePrompt ? `${resolved.stylePrompt}\n\n${text}` : text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: resolved.voice || 'Kore' } },
            },
          },
        }),
      });
      if (!resp.ok) throw new Error(`Google TTS Fehler (${resp.status})`);
      const json = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inline?.data) throw new Error('Keine Audiodaten von Google AI Studio erhalten.');
      const wav = ensureWavBytes(base64ToUint8Array(inline.data));
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' });
      storeInAudioCache(key, blob);
      return blob;
    }

    if (resolved.provider === 'elevenlabs') {
      const voiceId = encodeURIComponent(resolved.voice || '21m00Tcm4TlvDq8ikWAM');
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          'xi-api-key': resolved.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: resolved.model || 'eleven_flash_v2_5',
        }),
      });
      if (!resp.ok) throw new Error(`ElevenLabs Fehler (${resp.status})`);
      const blob = await resp.blob();
      storeInAudioCache(key, blob);
      return blob;
    }

    const endpoint = resolved.provider === 'openai'
      ? 'https://api.openai.com/v1/audio/speech'
      : resolved.customEndpoint || 'https://api.openai.com/v1/audio/speech';
    const resp = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolved.model || 'gpt-4o-mini-tts',
        input: text,
        voice: resolved.voice || 'sage',
        ...(resolved.stylePrompt && resolved.model === 'gpt-4o-mini-tts' ? { instructions: resolved.stylePrompt } : {}),
        response_format: 'mp3',
      }),
    });
    if (!resp.ok) throw new Error(`TTS-Anbieter Fehler (${resp.status})`);
    const blob = await resp.blob();
    storeInAudioCache(key, blob);
    return blob;
  })();

  inflightClips.set(key, task);
  try {
    return await task;
  } finally {
    inflightClips.delete(key);
  }
}

export function prefetchSpeechClip(
  text: string,
  scenario: TTSScenarioId,
  ttsConfig: TTSProviderConfig,
  aiConfig: AIProviderConfig | undefined,
  lang: AppLanguage,
): void {
  if (!hasCloudTTS(ttsConfig, aiConfig) || !text.trim()) return;
  void synthesizeSpeechBlob(text, scenario, ttsConfig, aiConfig, lang).catch(() => {
    // Opportunistic prefetch never surfaces background errors.
  });
}

export function getTTSSampleText(lang: AppLanguage, scenario: TTSScenarioId): string {
  const samples: Record<AppLanguage, Record<TTSScenarioId, string>> = {
    de: {
      article: 'Willkommen bei OpenNews. So klingen deine Artikel beim entspannten Vorlesen.',
      briefing: 'Guten Morgen! Hier ist dein kompakter Tagesüberblick aus deinen wichtigsten Quellen.',
      focus: 'Lehne dich zurück. OpenNews liest dir diesen Beitrag in ruhigem Tempo vor.',
    },
    en: {
      article: 'Welcome to OpenNews. This is how your articles sound when read aloud.',
      briefing: 'Good morning! Here is your concise daily briefing from your selected sources.',
      focus: 'Sit back and relax. OpenNews reads this story at a calm evening pace.',
    },
    fr: {
      article: 'Bienvenue sur OpenNews. Voici la voix utilisée pour lire vos articles.',
      briefing: 'Bonjour ! Voici votre synthèse quotidienne issue de vos sources.',
      focus: 'Installez-vous confortablement. OpenNews vous lit cet article à un rythme apaisé.',
    },
    es: {
      article: 'Bienvenido a OpenNews. Así sonarán tus artículos al escucharlos.',
      briefing: '¡Buenos días! Aquí tienes tu resumen diario con lo más relevante de hoy.',
      focus: 'Relájate. OpenNews te lee este artículo a un ritmo tranquilo.',
    },
    it: {
      article: 'Benvenuto su OpenNews. Ecco la voce che leggerà i tuoi articoli.',
      briefing: 'Buongiorno! Ecco la rassegna di oggi dalle tue fonti preferite.',
      focus: 'Rilassati. OpenNews legge questo articolo con un ritmo calmo.',
    },
    pt: {
      article: 'Bem-vindo ao OpenNews. É assim que seus artigos soam na leitura em voz alta.',
      briefing: 'Bom dia! Aqui está o seu resumo diário das principais notícias.',
      focus: 'Relaxe. O OpenNews lê esta matéria em um ritmo tranquilo.',
    },
  };
  return samples[lang]?.[scenario] ?? samples.de.article;
}
