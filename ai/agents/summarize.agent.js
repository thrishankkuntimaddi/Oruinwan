'use strict';

const BaseAgent = require('./base.agent');
const config = require('../config');

const MAX_INPUT_CHARS = 60_000;

class SummarizeAgent extends BaseAgent {
  constructor(opts) {
    super({
      name: 'summarize',
      model: config.models.fast,
      systemPrompt: 'You write clear, faithful summaries. Keep names, decisions, deadlines and open questions.',
      ...opts,
    });
  }

  /**
   * @param {{ text: string, style?: 'brief'|'detailed'|'bullets' }} payload
   * @returns {Promise<{ summary: string }>}
   */
  async run(payload) {
    const { text, style = 'brief' } = payload;
    if (!text || !String(text).trim()) throw new Error('summarize: text is required');

    const guidance = {
      brief: 'Summarize the following in a short paragraph.',
      detailed: 'Summarize the following in detail, preserving structure and all decisions.',
      bullets: 'Summarize the following as concise bullet points.',
    }[style] || 'Summarize the following clearly and concisely.';

    const summary = await this.provider.generateText({
      model: this.model,
      systemInstruction: this.systemPrompt,
      prompt: `${guidance}\n\n${String(text).slice(0, MAX_INPUT_CHARS)}`,
    });
    return { summary: summary.trim() };
  }
}

module.exports = SummarizeAgent;
