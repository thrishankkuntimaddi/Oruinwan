'use strict';

const BaseAgent = require('./base.agent');
const config = require('../config');

const PRIORITIES = new Set(['low', 'medium', 'high']);

class TaskAgent extends BaseAgent {
  constructor(opts) {
    super({
      name: 'task',
      model: config.models.fast,
      systemPrompt: 'You extract actionable tasks from text and answer with JSON only.',
      ...opts,
    });
  }

  /**
   * @param {{ context: string }} payload
   * @returns {Promise<{ title: string, description: string, priority: 'low'|'medium'|'high', dueDate?: string }>}
   */
  async run(payload) {
    const { context } = payload;
    if (!context || !String(context).trim()) throw new Error('generateTask: context is required');

    const prompt = [
      `Extract a single task from the following context: "${String(context).slice(0, 8_000)}"`,
      'Return ONLY a JSON object with the keys',
      '"title" (short imperative), "description", "priority" (low|medium|high) and optional "dueDate" (YYYY-MM-DD).',
      'No markdown, no code fences.',
    ].join('\n');

    const raw = await this.provider.generateText({
      model: this.model,
      systemInstruction: this.systemPrompt,
      prompt,
      generationConfig: { temperature: 0.2 },
    });

    return TaskAgent.parse(raw, context);
  }

  static parse(raw, context) {
    const fallback = { title: 'New Task', description: String(context).slice(0, 500), priority: 'medium' };
    if (!raw) return fallback;
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      const parsed = JSON.parse(match[0]);
      const out = {
        title: String(parsed.title || fallback.title).trim().slice(0, 200),
        description: String(parsed.description || '').trim(),
        priority: PRIORITIES.has(parsed.priority) ? parsed.priority : 'medium',
      };
      if (typeof parsed.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) out.dueDate = parsed.dueDate;
      return out;
    } catch {
      return fallback;
    }
  }
}

module.exports = TaskAgent;
