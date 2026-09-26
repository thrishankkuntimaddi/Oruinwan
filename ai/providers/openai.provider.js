'use strict';

const config = require('../config');

/**
 * OpenAI-compatible chat-completions provider (no SDK, plain fetch).
 *
 * Works for OpenAI itself and for any server speaking the same API: Ollama,
 * LM Studio, vLLM, LiteLLM, Azure-style gateways… — pass `baseUrl`.
 *
 * Provider interface (same as GeminiProvider):
 *   generateText({ model?, prompt, systemInstruction?, generationConfig?, onToken?, signal? }) -> string
 *   chat({ model?, systemInstruction?, history, message, tools?, generationConfig?, onToken?, signal? })
 *     -> { text, functionCalls: [{ name, args }], continue(toolResults) -> same shape }
 * `onToken(text)` streams text deltas as they arrive; `signal` cancels.
 */
class OpenAIProvider {
  constructor({ apiKey, baseUrl, name = 'openai', defaultModels } = {}) {
    this.name = name;
    this.apiKey = apiKey ?? (name === 'local_llm' ? config.keys.local_llm : config.keys.openai);
    this.baseUrl = (baseUrl || (name === 'local_llm' ? config.endpoints.local_llm : config.endpoints.openai)).replace(/\/$/, '');
    this.models = defaultModels || config.models.byProvider[name] || config.models.byProvider.openai;
  }

  get supportsStreaming() {
    return true;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * One chat-completions request. With `onToken` the response is streamed
   * (SSE) and every text delta is forwarded as it arrives; tool calls that
   * arrive in fragments are reassembled. Either way the resolved value is the
   * complete assistant message `{ role, content, tool_calls? }`.
   * `signal` (AbortSignal) cancels the request, e.g. when the user presses Stop.
   */
  async _complete(body, { onToken, signal } = {}) {
    if (!this.apiKey) {
      const err = new Error(`AI provider not configured: set the ${this.name} API key`);
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('AI request timed out')), config.timeoutMs);
    const onAbort = () => controller.abort(signal.reason || new Error('aborted'));
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    const stream = typeof onToken === 'function';
    try {
      let res;
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(stream ? { ...body, stream: true } : body),
          signal: controller.signal,
        });
      } catch (err) {
        throw this._networkError(err, controller.signal);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data?.error?.message || `${this.name} request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      if (!stream) {
        const data = await res.json().catch(() => ({}));
        return data.choices?.[0]?.message || {};
      }
      return await this._readStream(res, onToken, controller.signal);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  _networkError(err, signal) {
    if (signal?.aborted) {
      const e = new Error('AI request cancelled');
      e.code = 'AI_ABORTED';
      return e;
    }
    if (this.name === 'local_llm') {
      const e = new Error(`The Oruinwan AI engine is not reachable at ${this.baseUrl}. Is the model server running?`);
      e.code = 'AI_ENGINE_UNAVAILABLE';
      return e;
    }
    return err;
  }

  /** Parse an OpenAI-style SSE stream into a full assistant message. */
  async _readStream(res, onToken, signal) {
    const decoder = new TextDecoder();
    const message = { role: 'assistant', content: '' };
    const calls = []; // index -> { id, type, function: { name, arguments } }
    let buffer = '';
    const handle = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') return;
      let chunk;
      try { chunk = JSON.parse(data); } catch { return; }
      const delta = chunk.choices?.[0]?.delta || {};
      if (typeof delta.content === 'string' && delta.content) {
        message.content += delta.content;
        try { onToken(delta.content); } catch { /* a listener error must not break the stream */ }
      }
      for (const tc of delta.tool_calls || []) {
        const i = typeof tc.index === 'number' ? tc.index : calls.length;
        const slot = calls[i] || (calls[i] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.function.name += tc.function.name;
        if (tc.function?.arguments) {
          slot.function.arguments += typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments);
        }
      }
    };
    try {
      for await (const part of res.body) {
        buffer += decoder.decode(part, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          handle(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      if (buffer) handle(buffer);
    } catch (err) {
      throw this._networkError(err, signal);
    }
    const toolCalls = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
    if (toolCalls.length) message.tool_calls = toolCalls;
    return message;
  }

  _generationParams(generationConfig = {}) {
    const merged = { ...config.generation, ...generationConfig };
    const out = { max_tokens: merged.maxOutputTokens };
    if (merged.temperature !== undefined) out.temperature = merged.temperature;
    if (merged.responseMimeType === 'application/json') out.response_format = { type: 'json_object' };
    return out;
  }

  async generateText({ model, prompt, systemInstruction, generationConfig, onToken, signal }) {
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });
    const msg = await this._complete({ model: model || this.models.fast, messages, ...this._generationParams(generationConfig) }, { onToken, signal });
    return typeof msg.content === 'string' ? msg.content : '';
  }

  async chat({ model, systemInstruction, history = [], message, tools, generationConfig, onToken, signal }) {
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
      const reply = await this._complete({ ...request, messages }, { onToken, signal });
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
