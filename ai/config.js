'use strict';

/**
 * AI subsystem configuration. Everything is overridable through env vars.
 *
 * Default engine: Oruinwan's own model served by an OpenAI-compatible runtime
 * we control (`local_llm`): Ollama on a developer machine, vLLM / Ollama on a
 * GPU server in the cloud. Moving to the cloud only means changing
 * LOCAL_LLM_BASE_URL (and optionally the model names); no code changes.
 *
 * Third-party providers ('gemini' | 'openai' | 'anthropic') remain available
 * only when explicitly selected with AI_PROVIDER or per workspace. 'mock' is
 * used under test.
 */
const env = process.env;

const provider = env.AI_PROVIDER || (env.NODE_ENV === 'test' ? 'mock' : 'local_llm');
const localChat = env.LOCAL_LLM_MODEL || 'qwen2.5:3b';
const localFast = env.LOCAL_LLM_FAST_MODEL || localChat;

const byProvider = {
  local_llm: { chat: localChat, fast: localFast },
  gemini: { chat: env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash', fast: env.GEMINI_FAST_MODEL || 'gemini-2.5-flash' },
  openai: { chat: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', fast: env.OPENAI_FAST_MODEL || 'gpt-4o-mini' },
  anthropic: { chat: env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-5', fast: env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5-20251001' },
  mock: { chat: 'mock', fast: 'mock' },
};

module.exports = {
  provider,

  /** Model ids. `chat` drives the assistant, `fast` the one-shot helpers. */
  models: {
    ...(byProvider[provider === 'claude' ? 'anthropic' : provider] || byProvider.local_llm),
    byProvider,
    /** Optional coding model for code reviews on the local engine (empty = use the chat model). */
    code: env.LOCAL_LLM_CODE_MODEL || '',
    /** Embedding model for workspace knowledge search (served by the same local runtime). */
    embed: env.LOCAL_EMBED_MODEL || 'nomic-embed-text',
  },

  /** Human-facing engine name shown in the UI. */
  engineName: env.AI_ENGINE_NAME || 'Oruinwan Engine',

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
    embed: env.LOCAL_EMBED_BASE_URL || env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1',
  },

  generation: {
    maxOutputTokens: Number(env.AI_MAX_OUTPUT_TOKENS || 2000),
    temperature: env.AI_TEMPERATURE !== undefined ? Number(env.AI_TEMPERATURE) : undefined,
  },

  /** Upper bound on tool-call rounds inside a single chat turn. */
  maxToolRounds: Number(env.AI_MAX_TOOL_ROUNDS || 4),

  /** Request timeout for provider HTTP calls (local models on a laptop can be slow to load). */
  timeoutMs: Number(env.AI_TIMEOUT_MS || 120_000),

  /** Context window requested from the local runtime (Ollama `num_ctx`). */
  localContextTokens: Number(env.LOCAL_LLM_CONTEXT || 8192),

  memory: {
    maxTurns: Number(env.AI_MEMORY_MAX_TURNS || 20),
    ttlMs: Number(env.AI_MEMORY_TTL_MS || 30 * 60 * 1000),
    maxConversations: Number(env.AI_MEMORY_MAX_CONVERSATIONS || 1000),
  },
};
