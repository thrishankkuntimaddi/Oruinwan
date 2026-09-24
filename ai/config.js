'use strict';

/**
 * AI subsystem configuration. Everything is overridable through env vars so the
 * same code runs against Gemini in production and the mock provider in tests.
 */
module.exports = {
  provider: process.env.AI_PROVIDER || (process.env.NODE_ENV === 'test' ? 'mock' : 'gemini'),

  models: {
    chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    fast: process.env.GEMINI_FAST_MODEL || 'gemini-2.5-flash',
  },

  generation: {
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 2000),
    temperature: process.env.AI_TEMPERATURE !== undefined ? Number(process.env.AI_TEMPERATURE) : undefined,
  },

  /** Upper bound on tool-call rounds inside a single chat turn. */
  maxToolRounds: Number(process.env.AI_MAX_TOOL_ROUNDS || 4),

  memory: {
    maxTurns: Number(process.env.AI_MEMORY_MAX_TURNS || 20),
    ttlMs: Number(process.env.AI_MEMORY_TTL_MS || 30 * 60 * 1000),
    maxConversations: Number(process.env.AI_MEMORY_MAX_CONVERSATIONS || 1000),
  },
};
