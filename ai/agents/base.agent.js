'use strict';

/**
 * Base class for agents. An agent owns a system prompt, an optional tool set,
 * and a `run(payload, context)` method. Agents never talk to the vendor SDK
 * directly; they go through the injected provider.
 */
class BaseAgent {
  /**
   * @param {object} opts
   * @param {string} opts.name
   * @param {object} opts.provider   Provider implementing generateText/chat.
   * @param {string} [opts.systemPrompt]
   * @param {string} [opts.model]
   * @param {Array}  [opts.tools]    Entries from tools/registry createTools().
   * @param {object} [opts.logger]
   */
  constructor({ name, provider, systemPrompt = '', model, tools = [], logger }) {
    if (!name) throw new Error('Agent requires a name');
    if (!provider) throw new Error(`Agent ${name} requires a provider`);
    this.name = name;
    this.provider = provider;
    this.systemPrompt = systemPrompt;
    this.model = model;
    this.tools = tools;
    this.logger = logger || require('../utils/logger');
  }

  // eslint-disable-next-line no-unused-vars
  async run(_payload, _context) {
    throw new Error(`Agent ${this.name} does not implement run()`);
  }
}

module.exports = BaseAgent;
