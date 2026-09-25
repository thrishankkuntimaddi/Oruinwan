'use strict';

/**
 * Mock provider for tests and local development without an API key.
 *
 * `handler({ kind: 'text' | 'chat', ...request })` may return a string, or
 * an object `{ text, functionCalls, next }` where `next` is the reply to the
 * tool results in a follow-up round.
 */
class MockProvider {
  constructor(handler) {
    this.name = 'mock';
    this.isConfigured = true;
    this.models = { chat: 'mock', fast: 'mock' };
    this.calls = [];
    this.handler = handler || (({ kind, prompt, message }) =>
      kind === 'text' ? `mock:${prompt}` : `mock:${message}`);
  }

  async generateText(request) {
    this.calls.push({ kind: 'text', ...request });
    const out = await this.handler({ kind: 'text', ...request });
    return typeof out === 'string' ? out : out.text || '';
  }

  async chat(request) {
    this.calls.push({ kind: 'chat', ...request });
    const out = await this.handler({ kind: 'chat', ...request });
    return this._wrap(out, request);
  }

  _wrap(out, request) {
    const shaped = typeof out === 'string' ? { text: out } : out || {};
    return {
      text: shaped.text || '',
      functionCalls: shaped.functionCalls || [],
      continue: async (toolResults) => {
        this.calls.push({ kind: 'tool-results', toolResults, ...request });
        const next = typeof shaped.next === 'function' ? await shaped.next(toolResults) : shaped.next;
        return this._wrap(next === undefined ? { text: '' } : next, request);
      },
    };
  }
}

module.exports = MockProvider;
