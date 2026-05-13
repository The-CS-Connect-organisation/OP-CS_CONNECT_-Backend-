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
  // Filter out providers with no API key configured
  const available = providers.filter(p => p.key && p.key.length > 0);
  if (!available.length) {
    throw new ApiError(503, 'No AI providers configured. Please set CEREBRAS_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY.');
  }
  let lastError = null;
  for (const provider of available) {
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
  // If mode is a specific model ID, create a custom provider list for it
  if (mode && !['balanced', 'advanced'].includes(mode)) {
    // Try to find which provider can handle this model
    const customProviders = [];
    
    // Check Cerebras models
    const cerebrasModels = ['llama3.1-8b', 'qwen-3-235b-a22b-instruct-2507'];
    if (cerebrasModels.includes(mode) && env.CEREBRAS_API_KEY) {
      customProviders.push({
        name: 'Cerebras',
        url: 'https://api.cerebras.ai/v1/chat/completions',
        key: env.CEREBRAS_API_KEY,
        model: mode,
      });
    }
    
    // Check Groq models
    const groqModels = [
      'llama-3.1-8b-instant', 'llama-3.3-70b-versatile',
      'allam-2-7b', 'canopylabs/orpheus-arabic-saudi', 'canopylabs/orpheus-v1-english',
      'groq/compound', 'groq/compound-mini',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-prompt-guard-2-22m', 'meta-llama/llama-prompt-guard-2-86m',
      'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'openai/gpt-oss-safeguard-20b',
      'qwen/qwen3-32b', 'whisper-large-v3', 'whisper-large-v3-turbo'
    ];
    if (groqModels.includes(mode) && env.GROQ_API_KEY) {
      customProviders.push({
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: env.GROQ_API_KEY,
        model: mode,
      });
    }
    
    // Fallback to Gemini if model not found
    if (customProviders.length === 0 && env.GEMINI_API_KEY) {
      customProviders.push({
        name: 'Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        key: env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash',
      });
    }
    
    if (customProviders.length > 0) {
      return tryProviders(customProviders, messages);
    }
  }
  
  // Original balanced/advanced modes
  const providers = mode === 'advanced' ? ADVANCED_PROVIDERS : BALANCED_PROVIDERS;
  return tryProviders(providers, messages);
};
