// server/ai/api/ai.gateway.js
/**
 * AI Gateway — Centralised LLM abstraction layer
 *
 * Framework-agnostic: no Express / Socket.IO imports.
 * All controllers and services call this file; it owns the Gemini client.
 *
 * Exported methods:
 *   chat({ message, history, workspaceId }, { userId })  → { text }
 *   summarize({ text }, { userId })                       → { summary }
 *   generateTask({ context }, { userId })                  → { title, priority, description }
 *
 * All methods degrade gracefully when GEMINI_API_KEY is absent.
 */

'use strict';

// ── Lazy Gemini client ────────────────────────────────────────────────────────

let _genAI = null;

function getModel(modelName = 'gemini-1.5-flash') {
  if (!_genAI) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
    if (!apiKey) {
      console.warn('[AI Gateway] ⚠️  No Gemini API key — AI features will use fallback responses.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    console.log(`✅ [AI Gateway] Initialised with API Key (length: ${apiKey.length})`);
  }
  return _genAI.getGenerativeModel({ model: modelName });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Call Gemini with a plain prompt string.
 * Returns the trimmed response text, or throws so callers can handle fallback.
 */
async function _generate(prompt) {
  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * chat({ message, history, workspaceId }, { userId })
 *
 * General-purpose AI chat.  `history` is an array of { role, content } objects
 * (already-formatted conversation context).
 *
 * @returns {{ text: string }}
 */
async function chat({ message, history = [], workspaceId }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return { text: 'AI is not configured. Please add a GEMINI_API_KEY to your environment.' };
  }

  try {
    // Build a single prompt from history + current message
    const historyText = history
      .map(h => `${h.role === 'assistant' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n');

    const fullPrompt = historyText
      ? `${historyText}\nUser: ${message}\nAssistant:`
      : message;

    const text = await _generate(fullPrompt);
    return { text };
  } catch (err) {
    console.error('[AI Gateway] chat error:', err.message);
    return { text: 'AI is temporarily unavailable. Please try again later.' };
  }
}

/**
 * summarize({ text }, { userId })
 *
 * Summarises arbitrary text in 2–4 sentences.
 *
 * @returns {{ summary: string }}
 */
async function summarize({ text }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey || !text?.trim()) {
    const fallback = (text || '').replace(/[#*>`_[\]]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    return { summary: fallback || 'No content to summarise.' };
  }

  try {
    const prompt = [
      'You are a concise technical writer.',
      'Summarise the following content in 2–4 clear, informative sentences.',
      'Return ONLY the summary — no bullet points, no headings, no formatting.',
      `\n---\n${text.substring(0, 8000)}`,
    ].join('\n');

    const summary = await _generate(prompt);
    return { summary };
  } catch (err) {
    console.error('[AI Gateway] summarize error:', err.message);
    const fallback = (text || '').replace(/[#*>`_[\]]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    return { summary: fallback || 'Summary unavailable.' };
  }
}

/**
 * generateTask({ context }, { userId })
 *
 * Given a free-text context, extracts a structured task.
 *
 * @returns {{ title: string, priority: string, description: string }}
 */
async function generateTask({ context }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return { title: 'New Task', priority: 'medium', description: context || '' };
  }

  try {
    const prompt = [
      'Given the following context, extract a structured task.',
      'Respond ONLY with a valid JSON object with these keys: "title" (string), "priority" ("low"|"medium"|"high"), "description" (string, max 2 sentences).',
      'No markdown fences, no extra text.',
      `\nContext: "${context}"`,
    ].join('\n');

    let raw = await _generate(prompt);
    // Strip markdown fences if model includes them
    raw = raw.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();

    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || 'New Task',
      priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
      description: parsed.description || '',
    };
  } catch (err) {
    console.error('[AI Gateway] generateTask error:', err.message);
    return { title: 'New Task', priority: 'medium', description: context || '' };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { chat, summarize, generateTask };
