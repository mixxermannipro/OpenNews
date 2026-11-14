import { withAIResult } from './aiCache';
import { Capacitor } from '@capacitor/core';
import { buildGroundedPrompt, parseArticleAnswer, parseBriefingText, parseSummaryBullets } from './aiResponse';
import type { AIProviderConfig, AIProviderId, AISummaryResult, NewsArticle } from '../types/news';

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  keyPlaceholder: string;
  docsHint: string;
  models: Array<{ id: string; label: string }>;
}

export const AI_PROVIDERS: AIProviderMeta[] = [
  {
    id: 'google',
    name: 'Google AI Studio (Gemini)',
    keyPlaceholder: 'AIzaSy...',
    docsHint: 'Kostenloser oder Pay-as-you-go Key aus Google AI Studio.',
    models: [
      { id: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    keyPlaceholder: 'sk-proj-...',
    docsHint: 'API-Schlüssel aus platform.openai.com.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (Schnell & sparsam)' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (Modern & ausgewogen)' },
      { id: 'gpt-4o', label: 'GPT-4o (Flaggschiff)' },
      { id: 'o4-mini', label: 'o4-mini (Reasoning)' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    keyPlaceholder: 'sk-ant-...',
    docsHint: 'API-Schlüssel aus console.anthropic.com.',
    models: [
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Schnell)' },
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (Redaktionell stark)' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI (EU)',
    keyPlaceholder: 'mistral-...',
    docsHint: 'Europäischer KI-Anbieter aus Paris (console.mistral.ai).',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small (Schnell & DSGVO-nah)' },
      { id: 'mistral-large-latest', label: 'Mistral Large (Komplexe Einordnung)' },
    ],
  },
  {
    id: 'custom',
    name: 'OpenRouter / Custom Endpoint',
    keyPlaceholder: 'sk-or-... oder leer bei lokalem Ollama',
    docsHint: 'Kompatibel mit OpenRouter, Groq, Together oder lokalem Ollama.',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OpenRouter)' },
      { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B (Lokal / Ollama)' },
    ],
  },
];

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: 'google',
  apiKey: '',
  model: 'gemini-flash-latest',
  customEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  autoSummarize: true,
};

export function migrateAIConfig(config: AIProviderConfig): AIProviderConfig {
  if (config.provider !== 'google') return config;
  if (config.model === 'gemini-2.5-flash') return { ...config, model: 'gemini-flash-latest' };
  if (config.model === 'gemini-2.5-flash-lite') return { ...config, model: 'gemini-flash-lite-latest' };
  return config;
}

function buildPrompt(article: NewsArticle): string {
  const body = article.paragraphs.join('\n\n') || article.summary;
  return buildGroundedPrompt(
    'Fasse den Artikel neutral auf Deutsch zusammen. Antworte nur als JSON mit bis zu vier kurzen Kernaussagen: {"bullets":["Kernaussage"]}.',
    { source: article.sourceName.slice(0, 160), category: article.category, title: article.title.slice(0, 240), text: body.slice(0, 6000) },
  );
}

export async function analyzeArticleWithBYOK(
  article: NewsArticle,
  config: AIProviderConfig
): Promise<AISummaryResult> {
  const providerMeta = AI_PROVIDERS.find((p) => p.id === config.provider);
  const providerLabel = `${providerMeta?.name || config.provider} · ${config.model}`;
  const prompt = buildPrompt(article);
  return withAIResult(config, 'summary', [article.id], prompt, async () => ({
    bullets: parseSummaryBullets(await requestAI(config, prompt, true)),
    mode: 'ai', providerLabel, generatedAt: new Date().toISOString(),
  }));
}

async function requestAI(config: AIProviderConfig, prompt: string, expectJson: boolean): Promise<string> {
  const modelId = config.model.trim();
  const model = config.provider === 'google' ? modelId.replace(/^models\//, '') : modelId;
  if (!model) throw new Error('Bitte gib eine Modell-ID ein.');

  // The Node server exists only in web/dev mode; installed APKs use native HTTP.
  // Avoid attempting https://localhost/api/... in the standalone Android WebView.
  // Keyless custom endpoints can only be contacted directly from the device.
  if (!Capacitor.isNativePlatform() && (config.provider !== 'custom' || config.apiKey.trim())) {
    try {
      const proxyResp = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey.trim(),
          model,
          customEndpoint: config.customEndpoint?.trim(),
          prompt,
        }),
      });

      if (proxyResp.ok) {
        const data = (await proxyResp.json()) as { text?: string; error?: string };
        if (data.text) {
          return data.text;
        }
        if (data.error) {
          throw new Error(data.error);
        }
      } else if (proxyResp.status !== 404) {
        const errData = (await proxyResp.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `KI-Anfrage fehlgeschlagen (${proxyResp.status})`);
      }
    } catch (err) {
      // If offline or running pure Capacitor native without local Node server, try direct browser call for Google/OpenRouter
      if (err instanceof Error && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
  }

  // Direct fallback (works in Capacitor Android/iOS or standalone static PWA)
  if (config.provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: expectJson ? 'application/json' : 'text/plain' },
      }),
    });
    if (!res.ok) throw new Error(`Google AI Fehler (${res.status})`);
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  if (config.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API Fehler (${response.status})`);
    const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = json.content?.find(part => part.type === 'text')?.text || '';
    return text;
  }

  const endpoint =
    config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : config.provider === 'mistral'
        ? 'https://api.mistral.ai/v1/chat/completions'
        : config.customEndpoint || 'https://openrouter.ai/api/v1/chat/completions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`KI-Provider Fehler (${res.status})`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content || '';
  return text;
}

export async function testAIConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }> {
  if (!config.apiKey.trim() && config.provider !== 'custom') {
    return { ok: false, message: 'Bitte gib zuerst einen API-Key ein.' };
  }
  try {
    const reply = await requestAI(config, 'Antworte nur mit dem Wort OK.', false);
    if (!reply.trim()) return { ok: false, message: 'Der Anbieter hat leer geantwortet.' };
    return { ok: true, message: `Verbunden mit ${config.model.trim()}` };
  } catch {
    return { ok: false, message: 'Verbindung fehlgeschlagen. Prüfe API-Schlüssel, Modell-ID und Internetverbindung.' };
  }
}

export async function createAudioBriefing(config: AIProviderConfig, articles: NewsArticle[]): Promise<string> {
  const text = articles.slice(0, 8).map(article => ({
    title: article.title.slice(0, 240),
    source: article.sourceName.slice(0, 160),
    summary: (article.summary || article.paragraphs[0] || '').slice(0, 600),
  }));
  const prompt = buildGroundedPrompt([
    'Erstelle einen sachlichen, gesprochenen Nachrichtenüberblick auf Deutsch mit höchstens 320 Wörtern.',
    'Nenne die Quellen im Text exakt wie angegeben. Verwende weder Markdown noch persönliche Empfehlungen.',
    'Antworte ausschließlich als JSON: {"text":"Nachrichtenüberblick"}.',
  ].join(' '), { articles: text });
  return withAIResult(config, 'briefing', articles.slice(0, 8).map(article => article.id), prompt,
    async () => parseBriefingText(await requestAI(config, prompt, true), text.map(article => article.source)));
}

export function buildArticleQuestionPrompt(article: NewsArticle, question: string) {
  const text = (article.paragraphs.join('\n\n') || article.summary).slice(0, 12_000);
  const prompt = buildGroundedPrompt(
    'Beantworte die Frage in der Sprache der Frage ausschließlich anhand des Artikeltexts. ' +
    'Gib ausschließlich JSON zurück: {"answer":"Kurze Antwort","quote":"Wörtlicher, zusammenhängender Beleg aus text"}. ' +
    'Ist die Antwort nicht aus dem Text belegbar, verwende {"answer":null,"quote":null}.',
    { question: question.trim().slice(0, 400), text },
  );
  return { prompt, text };
}

export function askArticleQuestion(article: NewsArticle, config: AIProviderConfig, question: string) {
  if (!question.trim()) return Promise.reject(new Error('Bitte gib eine Frage ein.'));
  const { prompt, text } = buildArticleQuestionPrompt(article, question);
  return withAIResult(config, 'question', [article.id], prompt,
    async () => parseArticleAnswer(await requestAI(config, prompt, true), text));
}
