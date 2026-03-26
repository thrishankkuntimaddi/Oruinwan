// server/src/modules/ai/ai-messaging.service.js
// Phase-8: AI-powered messaging helpers
//   - Smart reply suggestions (3 quick replies per message)
//   - Message / thread translation
//   - Thread summarization
//
// All results are cached in-process with a 5-minute TTL to avoid redundant
// API calls when multiple users trigger the same feature.
'use strict';

const gateway = require('../../../ai/api/ai.gateway');

// ─── Simple in-process TTL cache ────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _cache = new Map();

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function _cacheSet(key, value) {
  // Evict oldest entries if cache grows too large
  if (_cache.size > 500) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { value, ts: Date.now() });
}

// ─── Smart Reply Suggestions ────────────────────────────────────────────────

/**
 * Generate 3 quick-reply suggestions for a received message.
 *
 * @param {string} messageText     Plaintext of the message to reply to
 * @param {string} [messageId]     Optional message ID — used as cache key
 * @param {Array}  [contextMessages] Last few messages for context (each: { role, content })
 * @returns {Promise<string[]>}  Array of up to 3 suggestion strings
 */
async function getSmartReplies(messageText, messageId = null, contextMessages = []) {
  const cacheKey = `suggestions:${messageId || messageText.slice(0, 60)}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const systemPrompt =
    'You are a helpful messaging assistant. Given a message, return exactly 3 short natural-language reply suggestions as a JSON array of strings. Each suggestion should be under 15 words. Respond ONLY with the JSON array, no other text.';

  const context = contextMessages
    .slice(-4)
    .map(m => `${m.role === 'assistant' ? 'Them' : 'Me'}: ${m.content}`)
    .join('\n');

  const prompt = `${context ? `Context:\n${context}\n\n` : ''}Message to reply to: "${messageText}"`;

  let suggestions = ['👍 Got it!', 'Thanks for letting me know.', 'Sounds good!'];

  try {
    const result = await gateway.chat(
      { message: prompt, history: [{ role: 'system', content: systemPrompt }], workspaceId: null },
      { userId: 'system' }
    );

    const text = result?.text || result?.message || '';
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        suggestions = parsed.slice(0, 3).map(s => String(s).trim()).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn('[ai-messaging] Smart replies fallback (AI unavailable):', err.message);
  }

  _cacheSet(cacheKey, suggestions);
  return suggestions;
}

// ─── Translation ─────────────────────────────────────────────────────────────

/**
 * Translate `text` into `targetLang` (BCP-47 language tag, e.g. 'es', 'fr').
 *
 * @param {string} text
 * @param {string} targetLang
 * @param {string} [messageId]  Optional — used as cache key
 * @returns {Promise<{ translated: string, detectedLang: string|null }>}
 */
async function translateMessage(text, targetLang, messageId = null) {
  const cacheKey = `translate:${messageId || text.slice(0, 60)}:${targetLang}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const result = { translated: text, detectedLang: null };

  try {
    const prompt =
      `Translate the following text to ${targetLang}. Respond with ONLY a JSON object: { "translated": "<translation>", "detectedLang": "<detected-lang-code>" }.\n\nText: "${text}"`;

    const aiResult = await gateway.chat(
      { message: prompt, history: [], workspaceId: null },
      { userId: 'system' }
    );

    const raw = aiResult?.text || aiResult?.message || '';
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.translated) {
        result.translated = parsed.translated;
        result.detectedLang = parsed.detectedLang || null;
      }
    }
  } catch (err) {
    console.warn('[ai-messaging] Translation fallback (AI unavailable):', err.message);
  }

  _cacheSet(cacheKey, result);
  return result;
}

// ─── Thread Summarization ────────────────────────────────────────────────────

/**
 * Generate a concise AI summary of a thread.
 *
 * @param {string} parentMessageId  — used as cache key
 * @param {Array}  replies           Array of { text, senderName } objects (plaintext)
 * @param {string} [parentText]      Plaintext of the parent (root) message
 * @returns {Promise<string>}  Summary paragraph
 */
async function summarizeThread(parentMessageId, replies, parentText = '') {
  const cacheKey = `thread-summary:${parentMessageId}:${replies.length}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  if (!replies || replies.length === 0) {
    return 'No replies in this thread yet.';
  }

  let summary = `Thread with ${replies.length} reply/replies.`;

  try {
    const threadLines = [
      parentText ? `Root: "${parentText}"` : null,
      ...replies.map(r => `${r.senderName || 'User'}: "${r.text}"`),
    ]
      .filter(Boolean)
      .join('\n');

    const prompt =
      `Summarize the following chat thread in 2-3 sentences. Focus on decisions, action items, and conclusions. Respond with ONLY the summary text.\n\nThread:\n${threadLines}`;

    const aiResult = await gateway.chat(
      { message: prompt, history: [], workspaceId: null },
      { userId: 'system' }
    );

    const text = (aiResult?.text || aiResult?.message || '').trim();
    if (text) summary = text;
  } catch (err) {
    console.warn('[ai-messaging] Thread summary fallback (AI unavailable):', err.message);
  }

  _cacheSet(cacheKey, summary);
  return summary;
}

/** Invalidate cached summary when a new reply is posted */
function invalidateThreadSummary(parentMessageId) {
  // Remove all keys matching this parentMessageId prefix
  for (const key of _cache.keys()) {
    if (key.startsWith(`thread-summary:${parentMessageId}`)) {
      _cache.delete(key);
    }
  }
}

module.exports = {
  getSmartReplies,
  translateMessage,
  summarizeThread,
  invalidateThreadSummary,
};
