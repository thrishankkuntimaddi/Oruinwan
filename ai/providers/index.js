'use strict';

const config = require('../config');
const GeminiProvider = require('./gemini.provider');
const MockProvider = require('./mock.provider');

/** Build the provider named by AI_PROVIDER (gemini by default, mock under test). */
function createProvider(name = config.provider, options = {}) {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(options);
    case 'mock':
      return new MockProvider(options.handler);
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

module.exports = { createProvider, GeminiProvider, MockProvider };
