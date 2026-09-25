'use strict';

const { createProvider } = require('../providers');
const { createTools } = require('../tools/registry');
const { ConversationMemory } = require('../memory');
const agents = require('../agents');
const { createAiEvent } = require('../events/activityEvent');

/**
 * Orchestrator.
 *
 * Single entry point for AI work. Maps an intent to an agent, injects the
 * provider (default, or the per-workspace one passed in `context.provider`),
 * tools and memory, runs the agent, records the exchange in memory, reports
 * usage through `onUsage`, and returns the result together with an activity
 * event descriptor the caller can persist.
 */
const INTENT_SUBTYPE = {
  chat: 'chat',
  summarize: 'summary',
  generate_task: 'task_generated',
};

class Orchestrator {
  /**
   * @param {object} [opts]
   * @param {object} [opts.provider]  Provider instance (defaults from config).
   * @param {object} [opts.actions]   Side-effect implementations for tools.
   * @param {ConversationMemory} [opts.memory]
   * @param {object} [opts.logger]
   * @param {Function} [opts.onUsage] Called with { intent, agent, provider, model, userId, workspaceId, durationMs, ok, error } after every run.
   */
  constructor({ provider, actions = {}, memory, logger, onUsage } = {}) {
    this.provider = provider || createProvider();
    this.memory = memory || new ConversationMemory();
    this.logger = logger || require('../utils/logger');
    this.onUsage = onUsage || null;
    this.tools = createTools(actions);
    this.agents = new Map();

    const common = { provider: this.provider, logger: this.logger };
    this.registerAgent('chat', new agents.ChatAgent({ ...common, tools: this.tools }));
    this.registerAgent('summarize', new agents.SummarizeAgent(common));
    this.registerAgent('generate_task', new agents.TaskAgent(common));
    this.registerAgent('smart_replies', new agents.ReplyAgent(common));
    this.registerAgent('translate', new agents.TranslateAgent(common));
    this.registerAgent('draft', new agents.DraftAgent(common));
    this.registerAgent('conversation', new agents.ConversationAgent(common));
    this.registerAgent('extract_tasks', new agents.ExtractTasksAgent(common));
    this.registerAgent('note_assist', new agents.NoteAgent(common));
    this.registerAgent('answer', new agents.AnswerAgent(common));
    this.registerAgent('rerank', new agents.RerankAgent(common));
    this.registerAgent('classify_intent', new agents.IntentAgent(common));
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

  listIntents() {
    return [...this.agents.keys()];
  }

  /**
   * @param {string} intent
   * @param {object} payload   Agent-specific input.
   * @param {object} context   { userId, workspaceId?, req?, io?, remember?, provider?, model? }
   * @returns {Promise<object>} Agent result plus `event`.
   */
  async run(intent, payload = {}, context = {}) {
    const agent = this.getAgent(intent);
    const started = Date.now();
    const provider = context.provider || this.provider;
    const useMemory = intent === 'chat' && context.remember !== false && context.userId && context.userId !== 'system';
    const memoryKey = useMemory ? ConversationMemory.key(context.userId, payload.workspaceId || context.workspaceId) : null;

    let input = payload;
    if (useMemory && (!payload.history || payload.history.length === 0)) {
      input = { ...payload, history: this.memory.get(memoryKey) };
    }

    let result;
    try {
      result = await agent.run(input, context);
    } catch (err) {
      this._usage({ intent, agent, provider, context, started, ok: false, error: err });
      throw err;
    }

    if (useMemory) {
      this.memory.append(memoryKey, [
        { role: 'user', text: payload.message },
        { role: 'model', text: result.text || '' },
      ]);
    }

    const durationMs = Date.now() - started;
    const event = createAiEvent(INTENT_SUBTYPE[intent] || intent, context.userId || 'system', payload.workspaceId || context.workspaceId || null, {
      intent,
      agent: agent.name,
      provider: provider.name,
      model: agent.modelFor(context),
      durationMs,
    });

    this._usage({ intent, agent, provider, context, started, ok: true });
    this.logger.debug(`[AI] ${intent} via ${agent.name}/${provider.name} in ${durationMs}ms`);
    return { ...result, event };
  }

  _usage({ intent, agent, provider, context, started, ok, error }) {
    if (!this.onUsage) return;
    try {
      const out = this.onUsage({
        intent,
        agent: agent.name,
        provider: provider.name,
        model: agent.modelFor(context),
        userId: context.userId || null,
        workspaceId: context.workspaceId || null,
        durationMs: Date.now() - started,
        ok,
        error: error ? error.message : null,
      });
      if (out && typeof out.catch === 'function') out.catch(() => {});
    } catch { /* usage logging must never break a request */ }
  }

  clearMemory({ userId, workspaceId } = {}) {
    return this.memory.clear(ConversationMemory.key(userId, workspaceId));
  }
}

module.exports = Orchestrator;
