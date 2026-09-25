'use strict';

const config = require('../config');
const GeminiProvider = require('./gemini.provider');
const OpenAIProvider = require('./openai.provider');
const AnthropicProvider = require('./anthropic.provider');
const MockProvider = require('./mock.provider');

/**
 * Provider registry. Built-ins: gemini, openai, anthropic, local_llm (any
 * OpenAI-compatible endpoint) and mock. Register more with
 * `registerProvider(name, (options) => providerInstance)`.
 */
const factories = new Map([
  ['gemini', (options) => new GeminiProvider(options)],
  ['openai', (options) => new OpenAIProvider({ ...options, name: 'openai' })],
  ['local_llm', (options) => new OpenAIProvider({ ...options, name: 'local_llm' })],
  ['anthropic', (options) => new AnthropicProvider(options)],
  ['claude', (options) => new AnthropicProvider(options)],
  ['mock', (options) => new MockProvider(options.handler)],
]);

function registerProvider(name, factory) {
  factories.set(name, factory);
}

function listProviders() {
  return [...factories.keys()].filter((n) => n !== 'claude');
}

/** Build the provider named by AI_PROVIDER (gemini by default, mock under test). */
function createProvider(name = config.provider, options = {}) {
  const factory = factories.get(name);
  if (!factory) throw new Error(`Unknown AI provider: ${name}`);
  return factory(options);
}

/** Default model ids for a provider name (falls back to gemini's). */
function modelsFor(name) {
  return config.models.byProvider[name === 'claude' ? 'anthropic' : name] || config.models.byProvider.gemini;
}

module.exports = { createProvider, registerProvider, listProviders, modelsFor, GeminiProvider, OpenAIProvider, AnthropicProvider, MockProvider };
