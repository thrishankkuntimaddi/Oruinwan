'use strict';

/**
 * Base class for agents. An agent owns a system prompt, an optional tool set,
 * and a `run(payload, context)` method. Agents never talk to the vendor SDK
 * directly; they go through a provider — the one injected at construction or,
 * when a workspace has chosen its own model, the one passed in `context`.
 */
class BaseAgent {
  /**
   * @param {object} opts
   * @param {string} opts.name
   * @param {object} opts.provider   Provider implementing generateText/chat.
   * @param {string} [opts.systemPrompt]
   * @param {'chat'|'fast'} [opts.tier]  Which model tier the agent prefers.
   * @param {string} [opts.model]    Explicit model id (overrides tier).
   * @param {Array}  [opts.tools]    Entries from tools/registry createTools().
   * @param {object} [opts.logger]
   */
  constructor({ name, provider, systemPrompt = '', tier = 'fast', model, tools = [], logger }) {
    if (!name) throw new Error('Agent requires a name');
    if (!provider) throw new Error(`Agent ${name} requires a provider`);
    this.name = name;
    this.provider = provider;
    this.systemPrompt = systemPrompt;
    this.tier = tier;
    this.model = model;
    this.tools = tools;
    this.logger = logger || require('../utils/logger');
  }

  /** Provider for this call: a per-workspace override wins over the default. */
  providerFor(context = {}) {
    return context.provider || this.provider;
  }

  /** Model id for this call: explicit override, agent model, or the provider's tier default. */
  modelFor(context = {}) {
    const provider = this.providerFor(context);
    if (context.model) return context.model;
    if (this.model && provider === this.provider) return this.model;
    const models = provider.models || require('../config').models;
    return models[this.tier] || models.fast || models.chat;
  }

  /** One-shot generation shortcut used by the small agents. */
  generate(context, { prompt, systemInstruction = this.systemPrompt, generationConfig } = {}) {
    return this.providerFor(context).generateText({
      model: this.modelFor(context),
      systemInstruction,
      prompt,
      generationConfig,
    });
  }

  // eslint-disable-next-line no-unused-vars
  async run(_payload, _context) {
    throw new Error(`Agent ${this.name} does not implement run()`);
  }
}

module.exports = BaseAgent;
