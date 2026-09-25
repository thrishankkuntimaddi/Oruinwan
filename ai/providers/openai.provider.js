'use strict';

const config = require('../config');

/**
 * OpenAI-compatible chat-completions provider (no SDK, plain fetch).
 *
 * Works for OpenAI itself and for any server speaking the same API: Ollama,
 * LM Studio, vLLM, LiteLLM, Azure-style gateways… — pass `baseUrl`.
 *
 * Provider interface (same as GeminiProvider):
 *   generateText({ model?, prompt, systemInstruction?, generationConfig? }) -> string
 *   chat({ model?, systemInstruction?, history, message, tools?, generationConfig? })
 *     -> { text, functionCalls: [{ name, args }], continue(toolResults) -> same shape }
 */
class OpenAIProvider {
  constructor({ apiKey, baseUrl, name = 'openai', defaultModels } = {}) {
    this.name = name;
    this.apiKey = apiKey ?? (name === 'local_llm' ? config.keys.local_llm : config.keys.openai);
    this.baseUrl = (baseUrl || (name === 'local_llm' ? config.endpoints.local_llm : config.endpoints.openai)).replace(/\/$/, '');
    this.models = defaultModels || config.models.byProvider[name] || config.models.byProvider.openai;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  async _complete(body) {
    if (!this.apiKey) {
      const err = new Error(`AI provider not configured: set the ${this.name} API key`);
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data?.error?.message || `${this.name} request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data.choices?.[0]?.message || {};
    } finally {
      clearTimeout(timer);
    }
  }

  _generationParams(generationConfig = {}) {
    const merged = { ...config.generation, ...generationConfig };
    const out = { max_tokens: merged.maxOutputTokens };
    if (merged.temperature !== undefined) out.temperature = merged.temperature;
    if (merged.responseMimeType === 'application/json') out.response_format = { type: 'json_object' };
    return out;
  }

  async generateText({ model, prompt, systemInstruction, generationConfig }) {
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });
    const msg = await this._complete({ model: model || this.models.fast, messages, ...this._generationParams(generationConfig) });
    return typeof msg.content === 'string' ? msg.content : '';
  }

  async chat({ model, systemInstruction, history = [], message, tools, generationConfig }) {
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    for (const h of history) messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
    messages.push({ role: 'user', content: message });

    const request = {
      model: model || this.models.chat,
      ...this._generationParams(generationConfig),
      ...(tools && tools.length && {
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    };

    const step = async () => {
      const reply = await this._complete({ ...request, messages });
      messages.push(reply);
      const calls = (reply.tool_calls || []).map((c) => ({
        id: c.id,
        name: c.function?.name,
        args: safeJson(c.function?.arguments),
      }));
      return {
        text: typeof reply.content === 'string' ? reply.content : '',
        functionCalls: calls.map(({ name, args }) => ({ name, args })),
        continue: async (toolResults) => {
          toolResults.forEach((r, i) => {
            messages.push({ role: 'tool', tool_call_id: calls[i]?.id || calls.find((c) => c.name === r.name)?.id, content: JSON.stringify(r.response ?? {}) });
          });
          return step();
        },
      };
    };
    return step();
  }
}

function safeJson(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

module.exports = OpenAIProvider;
