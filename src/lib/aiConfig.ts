import type { AIProviderConfig } from '../types/news';

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
