'use strict';

/**
 * AI subsystem configuration. Everything is overridable through env vars so the
 * same code runs against Gemini in production and the mock provider in tests.
 *
 * Providers: 'gemini' | 'openai' | 'anthropic' | 'local_llm' (OpenAI-compatible
 * endpoint such as Ollama / LM Studio / vLLM) | 'mock'. A workspace can also
 * pick its own provider and key (see server/src/features/ai/ai.provider.resolver.js).
 */
const env = process.env;

module.exports = {
  provider: env.AI_PROVIDER || (env.NODE_ENV === 'test' ? 'mock' : 'gemini'),

  /** Default model ids per provider. `chat` drives the assistant, `fast` the one-shot helpers. */
  models: {
    chat: env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    fast: env.GEMINI_FAST_MODEL || 'gemini-2.5-flash',
    byProvider: {
      gemini: { chat: env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash', fast: env.GEMINI_FAST_MODEL || 'gemini-2.5-flash' },
      openai: { chat: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', fast: env.OPENAI_FAST_MODEL || 'gpt-4o-mini' },
      anthropic: { chat: env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-5', fast: env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5-20251001' },
      local_llm: { chat: env.LOCAL_LLM_MODEL || 'llama3.1', fast: env.LOCAL_LLM_MODEL || 'llama3.1' },
      mock: { chat: 'mock', fast: 'mock' },
    },
  },

  keys: {
    gemini: env.GEMINI_API_KEY || env.GOOGLE_AI_KEY || '',
    openai: env.OPENAI_API_KEY || '',
    anthropic: env.ANTHROPIC_API_KEY || '',
    local_llm: env.LOCAL_LLM_API_KEY || 'local',
  },

  endpoints: {
    openai: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    anthropic: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    local_llm: env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1',
  },

  generation: {
    maxOutputTokens: Number(env.AI_MAX_OUTPUT_TOKENS || 2000),
    temperature: env.AI_TEMPERATURE !== undefined ? Number(env.AI_TEMPERATURE) : undefined,
  },

  /** Upper bound on tool-call rounds inside a single chat turn. */
  maxToolRounds: Number(env.AI_MAX_TOOL_ROUNDS || 4),

  /** Request timeout for provider HTTP calls. */
  timeoutMs: Number(env.AI_TIMEOUT_MS || 45_000),

  memory: {
    maxTurns: Number(env.AI_MEMORY_MAX_TURNS || 20),
    ttlMs: Number(env.AI_MEMORY_TTL_MS || 30 * 60 * 1000),
    maxConversations: Number(env.AI_MEMORY_MAX_CONVERSATIONS || 1000),
  },
};
