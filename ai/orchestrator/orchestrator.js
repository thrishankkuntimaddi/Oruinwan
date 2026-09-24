'use strict';

const { createProvider } = require('../providers');
const { createTools } = require('../tools/registry');
const { ConversationMemory } = require('../memory');
const { ChatAgent, SummarizeAgent, TaskAgent } = require('../agents');
const { createAiEvent } = require('../events/activityEvent');

/**
 * Orchestrator.
 *
 * Single entry point for AI work. Maps an intent to an agent, injects the
 * provider, tools and memory, runs the agent, records the exchange in memory,
 * and returns the result together with an activity event descriptor the
 * caller can persist.
 *
 * Intents: 'chat' | 'summarize' | 'generate_task' (extensible via registerAgent).
 */
class Orchestrator {
  /**
   * @param {object} [opts]
   * @param {object} [opts.provider]  Provider instance (defaults from config).
   * @param {object} [opts.actions]   Side-effect implementations for tools.
   * @param {ConversationMemory} [opts.memory]
   * @param {object} [opts.logger]
   */
  constructor({ provider, actions = {}, memory, logger } = {}) {
    this.provider = provider || createProvider();
    this.memory = memory || new ConversationMemory();
    this.logger = logger || require('../utils/logger');
    this.tools = createTools(actions);
    this.agents = new Map();

    const common = { provider: this.provider, logger: this.logger };
    this.registerAgent('chat', new ChatAgent({ ...common, tools: this.tools }));
    this.registerAgent('summarize', new SummarizeAgent(common));
    this.registerAgent('generate_task', new TaskAgent(common));
  }

  registerAgent(intent, agent) {
    this.agents.set(intent, agent);
    return this;
  }

  getAgent(intent) {
    const agent = this.agents.get(intent);
    if (!agent) throw new Error(`No agent registered for intent "${intent}"`);
    return agent;
  }

  /**
   * @param {string} intent
   * @param {object} payload   Agent-specific input.
   * @param {object} context   { userId, workspaceId?, req?, remember? }
   * @returns {Promise<object>} Agent result plus `event`.
   */
  async run(intent, payload = {}, context = {}) {
    const agent = this.getAgent(intent);
    const started = Date.now();
    const useMemory = intent === 'chat' && context.remember !== false && context.userId && context.userId !== 'system';
    const memoryKey = useMemory ? ConversationMemory.key(context.userId, payload.workspaceId || context.workspaceId) : null;

    let input = payload;
    if (useMemory && (!payload.history || payload.history.length === 0)) {
      input = { ...payload, history: this.memory.get(memoryKey) };
    }

    const result = await agent.run(input, context);

    if (useMemory) {
      this.memory.append(memoryKey, [
        { role: 'user', text: payload.message },
        { role: 'model', text: result.text || '' },
      ]);
    }

    const subtype = { chat: 'chat', summarize: 'summary', generate_task: 'task_generated' }[intent] || intent;
    const event = createAiEvent(subtype, context.userId || 'system', payload.workspaceId || context.workspaceId || null, {
      intent,
      agent: agent.name,
      provider: this.provider.name,
      durationMs: Date.now() - started,
    });

    this.logger.debug(`[AI] ${intent} via ${agent.name} in ${event.payload.durationMs}ms`);
    return { ...result, event };
  }

  clearMemory({ userId, workspaceId } = {}) {
    return this.memory.clear(ConversationMemory.key(userId, workspaceId));
  }
}

module.exports = Orchestrator;
