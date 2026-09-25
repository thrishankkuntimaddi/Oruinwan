'use strict';

const config = require('../config');
const resolveDependency = require('../utils/resolveDependency');

/**
 * Gemini provider.
 *
 * Wraps @google/generative-ai behind the small provider interface used by the
 * agents, so the rest of the AI layer never touches the vendor SDK directly.
 *
 * Provider interface:
 *   generateText({ model?, prompt, systemInstruction?, generationConfig? }) -> string
 *   chat({ model?, systemInstruction?, history, message, tools?, generationConfig? })
 *     -> { text, functionCalls: [{ name, args }], continue(toolResults) -> same shape }
 */
class GeminiProvider {
  constructor({ apiKey = config.keys.gemini, defaultModels } = {}) {
    this.name = 'gemini';
    this.apiKey = apiKey;
    this.models = defaultModels || config.models.byProvider.gemini;
    this._client = null;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  _getClient() {
    if (!this.apiKey) {
      const err = new Error('AI provider not configured: set GEMINI_API_KEY');
      err.code = 'AI_NOT_CONFIGURED';
      throw err;
    }
    if (!this._client) {
      const { GoogleGenerativeAI } = resolveDependency('@google/generative-ai');
      this._client = new GoogleGenerativeAI(this.apiKey);
    }
    return this._client;
  }

  _getModel({ model, systemInstruction, tools }) {
    const params = { model: model || this.models.chat };
    if (systemInstruction) params.systemInstruction = systemInstruction;
    if (tools && tools.length) params.tools = [{ functionDeclarations: tools }];
    return this._getClient().getGenerativeModel(params);
  }

  async generateText({ model, prompt, systemInstruction, generationConfig }) {
    const gen = this._getModel({ model: model || this.models.fast, systemInstruction });
    const result = await gen.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { ...config.generation, ...generationConfig },
    });
    return safeText(result.response);
  }

  async chat({ model, systemInstruction, history = [], message, tools, generationConfig }) {
    const gen = this._getModel({ model, systemInstruction, tools });
    const session = gen.startChat({
      history: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      generationConfig: { ...config.generation, ...generationConfig },
    });

    const wrap = (response) => ({
      text: safeText(response),
      functionCalls: (typeof response.functionCalls === 'function' && response.functionCalls()) || [],
      continue: async (toolResults) => {
        const result = await session.sendMessage(
          toolResults.map((r) => ({ functionResponse: { name: r.name, response: r.response } }))
        );
        return wrap(result.response);
      },
    });

    const result = await session.sendMessage(message);
    return wrap(result.response);
  }
}

/** response.text() throws when the reply has only function calls; treat that as empty text. */
function safeText(response) {
  try {
    return response.text() || '';
  } catch {
    return '';
  }
}

module.exports = GeminiProvider;
