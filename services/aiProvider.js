import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Balanced: fast Cerebras, fallback to Groq then Gemini
const BALANCED_PROVIDERS = [
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: env.CEREBRAS_API_KEY,
    model: 'llama3.1-8b',
  },
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: env.GROQ_API_KEY,
    model: 'meta-llama/llama-prompt-guard-2-22m',
  },
  {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
  },
];

// Advanced: Qwen3-235B via Cerebras, fallback to Groq then Gemini
const ADVANCED_PROVIDERS = [
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: env.CEREBRAS_API_KEY,
    model: 'qwen-3-235b-a22b-instruct-2507',
  },
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: env.GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
  },
  {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
  },
];

const tryProviders = async (providers, messages) => {
  let lastError = null;
  for (const provider of providers) {
    try {
      logger.info(`Attempting AI request with provider: ${provider.name} (${provider.model})`);
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: provider.model, messages, temperature: 0.7 }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} failed: ${response.status} - ${errorText}`);
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${provider.name} returned empty content`);

      logger.info(`Success from ${provider.name}`);
      return {
        content,
        provider: provider.name,
        model: provider.model,
        usage: {
          promptTokens: json?.usage?.prompt_tokens ?? 0,
          completionTokens: json?.usage?.completion_tokens ?? 0,
          totalTokens: json?.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      logger.warn(`Provider ${provider.name} failed`, { message: error.message });
      lastError = error;
    }
  }
  throw new ApiError(502, 'All AI providers failed', { originalError: lastError?.message });
};

export const chatWithFallback = async ({ messages, mode = 'balanced' }) => {
  const providers = mode === 'advanced' ? ADVANCED_PROVIDERS : BALANCED_PROVIDERS;
  return tryProviders(providers, messages);
};
