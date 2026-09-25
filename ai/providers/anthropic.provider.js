'use strict';

const config = require('../config');

/**
 * Anthropic Messages API provider (plain fetch, tool use supported).
 * Same provider interface as GeminiProvider / OpenAIProvider.
 */
class AnthropicProvider {
  constructor({ apiKey, baseUrl, defaultModels } = {}) {
    this.name = 'anthropic';
    this.apiKey = apiKey ?? config.keys.anthropic;
    this.baseUrl = (baseUrl || config.endpoints.anthropic).replace(/\/$/, '');
    this.models = defaultModels || config.models.byProvider.anthropic;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  async _messages(body) {
    if (!this.apiKey) {
      const err = new Error('AI provider not configured: set ANTHROPIC_API_KEY');
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data?.error?.message || `anthropic request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  _params(generationConfig = {}) {
    const merged = { ...config.generation, ...generationConfig };
    const out = { max_tokens: merged.maxOutputTokens };
    if (merged.temperature !== undefined) out.temperature = merged.temperature;
    return out;
  }

  async generateText({ model, prompt, systemInstruction, generationConfig }) {
    const data = await this._messages({
      model: model || this.models.fast,
      ...(systemInstruction && { system: systemInstruction }),
      messages: [{ role: 'user', content: prompt }],
      ...this._params(generationConfig),
    });
    return textOf(data);
  }

  async chat({ model, systemInstruction, history = [], message, tools, generationConfig }) {
    const messages = history.map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text }));
    messages.push({ role: 'user', content: message });
    const request = {
      model: model || this.models.chat,
      ...(systemInstruction && { system: systemInstruction }),
      ...this._params(generationConfig),
      ...(tools && tools.length && {
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters || { type: 'object', properties: {} } })),
      }),
    };

    const step = async () => {
      const data = await this._messages({ ...request, messages });
      messages.push({ role: 'assistant', content: data.content || [] });
      const uses = (data.content || []).filter((c) => c.type === 'tool_use');
      return {
        text: textOf(data),
        functionCalls: uses.map((u) => ({ name: u.name, args: u.input || {} })),
        continue: async (toolResults) => {
          messages.push({
            role: 'user',
            content: toolResults.map((r, i) => ({
              type: 'tool_result',
              tool_use_id: uses[i]?.id || uses.find((u) => u.name === r.name)?.id,
              content: JSON.stringify(r.response ?? {}),
            })),
          });
          return step();
        },
      };
    };
    return step();
  }
}

function textOf(data) {
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
}

module.exports = AnthropicProvider;
