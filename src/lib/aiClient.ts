import { Capacitor } from '@capacitor/core';
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
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Schnell & präzise)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Tiefe Analyse)' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Ultraschnell)' },
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
  model: 'gemini-2.5-flash',
  customEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  autoSummarize: true,
  includeContext: true,
  includePerspectives: true,
};

function buildPrompt(article: NewsArticle): string {
  const body = article.paragraphs.join('\n\n') || article.summary;
  return `Du bist ein neutraler, präziser Nachrichtenredakteur für die App OpenNews.
Analysiere den folgenden Nachrichtenartikel auf Deutsch und antworte AUSSCHLIESSLICH mit validem JSON ohne Markdown-Codeblock.

Schema:
{
  "bullets": ["3 prägnante Kernaussagen als ganze Sätze"],
  "context": "2-3 Sätze Hintergrund und politische/wirtschaftliche/technische Einordnung",
  "perspectives": ["2 verschiedene Perspektiven oder mögliche Folgen"],
  "criticalQuestions": ["2 hilfreiche Fragen für kritisches Mitdenken / Faktencheck"]
}

Quelle: ${article.sourceName}
Rubrik: ${article.category}
Titel: ${article.title}
Text:
${body.slice(0, 6000)}`;
}

function parseAIJsonResponse(rawText: string, providerLabel: string): AISummaryResult {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const slice = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;

  const parsed = JSON.parse(slice) as Partial<AISummaryResult>;
  return {
    bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0
      ? parsed.bullets.map(String).slice(0, 4)
      : ['Keine Kernaussagen extrahiert.'],
    context: typeof parsed.context === 'string' && parsed.context.trim()
      ? parsed.context.trim()
      : 'Keine zusätzliche Einordnung geliefert.',
    perspectives: Array.isArray(parsed.perspectives)
      ? parsed.perspectives.map(String).slice(0, 3)
      : [],
    criticalQuestions: Array.isArray(parsed.criticalQuestions)
      ? parsed.criticalQuestions.map(String).slice(0, 3)
      : [],
    mode: 'ai',
    providerLabel,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzeArticleWithBYOK(
  article: NewsArticle,
  config: AIProviderConfig
): Promise<AISummaryResult> {
  const providerMeta = AI_PROVIDERS.find((p) => p.id === config.provider);
  const providerLabel = `${providerMeta?.name || config.provider} · ${config.model}`;
  const prompt = buildPrompt(article);

  // The Node server exists only in web/dev mode; installed APKs use native HTTP.
  // Avoid attempting https://localhost/api/... in the standalone Android WebView.
  if (!Capacitor.isNativePlatform()) {
    try {
    const proxyResp = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        apiKey: config.apiKey.trim(),
        model: config.model.trim(),
        customEndpoint: config.customEndpoint?.trim(),
        prompt,
      }),
    });

    if (proxyResp.ok) {
      const data = (await proxyResp.json()) as { text?: string; error?: string };
      if (data.text) {
        return parseAIJsonResponse(data.text, providerLabel);
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Google AI Fehler (${res.status})`);
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIJsonResponse(text, providerLabel);
  }

  if (config.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API Fehler (${response.status})`);
    const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = json.content?.find(part => part.type === 'text')?.text || '';
    return parseAIJsonResponse(text, providerLabel);
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
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`KI-Provider Fehler (${res.status})`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content || '';
  return parseAIJsonResponse(text, providerLabel);
}

export async function testAIConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }> {
  if (!config.apiKey.trim() && config.provider !== 'custom') {
    return { ok: false, message: 'Bitte gib zuerst einen API-Key ein.' };
  }
  const resp = await fetch('/api/ai/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
      customEndpoint: config.customEndpoint?.trim(),
      prompt: 'Antworte nur mit dem Wort: OK',
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!resp.ok || data.error) {
    return { ok: false, message: data.error || `Fehler (${resp.status})` };
  }
  return { ok: true, message: `Verbunden mit ${config.model}` };
}
