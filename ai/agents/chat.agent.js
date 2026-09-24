'use strict';

const BaseAgent = require('./base.agent');
const config = require('../config');

const DEFAULT_SYSTEM_PROMPT = [
  'You are Chttrix Intelligence, the assistant built into the Chttrix workspace.',
  'Be concise and practical. When the user asks you to do something you have a tool for,',
  'call the tool instead of describing what you would do. Never invent channel or task IDs;',
  'look them up with the available tools first.',
].join(' ');

/**
 * Conversational agent with tool calling and multi-round execution.
 *
 * Accepts history entries in either of the shapes used across the codebase:
 *   { sender: 'user'|'ai', text }        (web client)
 *   { role: 'user'|'assistant'|'model'|'system', content|text }
 * System entries are folded into the system instruction.
 */
class ChatAgent extends BaseAgent {
  constructor(opts) {
    super({ name: 'chat', systemPrompt: DEFAULT_SYSTEM_PROMPT, ...opts });
    this.maxToolRounds = opts.maxToolRounds ?? config.maxToolRounds;
  }

  static normalizeHistory(history = []) {
    const system = [];
    const turns = [];
    for (const h of history) {
      if (!h) continue;
      const text = typeof h.text === 'string' ? h.text : typeof h.content === 'string' ? h.content : '';
      if (!text.trim()) continue;
      const role = h.role || (h.sender === 'user' ? 'user' : 'model');
      if (role === 'system') {
        system.push(text);
      } else {
        turns.push({ role: role === 'user' ? 'user' : 'model', text });
      }
    }
    // Providers require the history to start with a user turn and alternate.
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const alternating = [];
    for (const t of turns) {
      const last = alternating[alternating.length - 1];
      if (last && last.role === t.role) last.text += `\n${t.text}`;
      else alternating.push({ ...t });
    }
    return { system, turns: alternating };
  }

  /**
   * @param {{ message: string, history?: Array, workspaceId?: string }} payload
   * @param {{ userId: string, req?: object }} context
   * @returns {Promise<{ text: string, actionsExecuted?: Array }>}
   */
  async run(payload, context = {}) {
    const { message, history = [], workspaceId } = payload;
    if (!message || !String(message).trim()) throw new Error('chat: message is required');

    const { system, turns } = ChatAgent.normalizeHistory(history);
    const systemInstruction = [this.systemPrompt, ...system].filter(Boolean).join('\n\n');
    const toolCtx = { userId: context.userId, workspaceId: workspaceId || context.workspaceId || null, req: context.req || null };
    const toolsByName = new Map(this.tools.map((t) => [t.declaration.name, t]));

    let reply = await this.provider.chat({
      model: this.model,
      systemInstruction,
      history: turns,
      message,
      tools: this.tools.map((t) => t.declaration),
    });

    const actionsExecuted = [];
    let rounds = 0;
    while (reply.functionCalls.length && rounds < this.maxToolRounds) {
      rounds += 1;
      const results = await Promise.all(
        reply.functionCalls.map(async (call) => {
          const response = await this._execute(toolsByName, call, toolCtx);
          return { name: call.name, response };
        })
      );
      // Record in call order (Promise.all preserves it) rather than completion order.
      reply.functionCalls.forEach((call, i) => {
        actionsExecuted.push({ function: call.name, parameters: call.args, result: results[i].response });
      });
      // Send every tool result back, not only the first one.
      reply = await reply.continue(results);
    }

    const out = { text: reply.text };
    if (actionsExecuted.length) out.actionsExecuted = actionsExecuted;
    return out;
  }

  async _execute(toolsByName, call, ctx) {
    const tool = toolsByName.get(call.name);
    if (!tool) return { success: false, error: `Unknown function: ${call.name}` };
    try {
      this.logger.debug(`[AI] tool ${call.name}`, call.args);
      const result = await tool.execute(call.args || {}, ctx);
      return result === undefined ? { success: true } : result;
    } catch (err) {
      this.logger.error(`[AI] tool ${call.name} failed`, err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = ChatAgent;
