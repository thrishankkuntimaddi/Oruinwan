'use strict';
const logger = require('../../../utils/logger');

const crypto = require('crypto');
// The shared AI subsystem (repo-root ai/): gateway -> orchestrator -> provider.
const gateway = require('../../features/ai/ai.gatewayResolver');

function _hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 32);
}

const CACHE_TTL_MS = 5 * 60 * 1000;
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
  if (_cache.size > 500) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { value, ts: Date.now() });
}

/** Optional gateway context ({ userId, provider, model }) so a workspace's own provider is used. */
async function getSmartReplies(messageText, messageId = null, contextMessages = [], context = {}) {
  const prior = (Array.isArray(contextMessages) ? contextMessages : []).slice(-6)
    .map(m => ({ sender: m.role === 'assistant' || m.isMe ? 'Me' : (m.sender || 'Them'), text: m.content || m.text || '', isMe: m.role === 'assistant' || !!m.isMe }));
  const messages = [...prior, { sender: 'Them', text: String(messageText || '') }];
  const cacheKey = `suggestions:${_hash(JSON.stringify(messages))}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  let suggestions = ['👍 Got it!', 'Thanks for letting me know.', 'Sounds good!'];
  try {
    const out = await gateway.smartReplies({ messages }, { userId: context.userId || 'system', ...context });
    if (out.suggestions.length) suggestions = out.suggestions;
    _cacheSet(cacheKey, suggestions);
  } catch (err) {
    logger.warn('[ai-messaging] Smart replies fallback (AI unavailable):', err.message);
  }
  return suggestions;
}

/** Parse a translation reply: JSON object, fenced JSON, or plain text (kept for tests/back-compat). */
function parseTranslation(raw) {
  const { parseJson, stripFences } = require('../../../../ai/utils/json');
  const parsed = parseJson(raw);
  if (parsed && typeof parsed.translated === 'string' && parsed.translated.trim()) {
    return { translated: parsed.translated, detectedLang: typeof parsed.detectedLang === 'string' && parsed.detectedLang.trim() ? parsed.detectedLang.trim() : null };
  }
  return { translated: stripFences(raw), detectedLang: null };
}

/**
 * Translate plaintext supplied by the client (the server cannot read E2EE
 * messages). Cached by content hash, never by message id, so one user's
 * translation can never be served for another user's text.
 */
async function translateMessage(text, targetLang, context = {}) {
  const cacheKey = `translate:${_hash(`${targetLang}\n${text}`)}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;
  const out = await gateway.translate({ text, targetLang }, { userId: context.userId || 'system', ...context });
  const result = { translated: out.translated, detectedLang: out.detectedLang ?? null };
  _cacheSet(cacheKey, result);
  return result;
}

async function summarizeThread(parentMessageId, replies, parentText = '', context = {}) {
  if (!replies || replies.length === 0) {
    return 'No replies in this thread yet.';
  }
  const messages = replies.map(r => ({ sender: String(r?.sender || r?.senderName || 'User').slice(0, 80), text: String(r?.text || '').slice(0, 4000) }));
  const cacheKey = `thread-summary:${parentMessageId}:${_hash(JSON.stringify([parentText, messages]))}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const out = await gateway.conversation({ messages, mode: 'summary', parentText, title: 'Thread' }, { userId: context.userId || 'system', ...context });
  if (!out.text) throw new Error('Empty response from AI provider');
  _cacheSet(cacheKey, out.text);
  return out.text;
}

function invalidateThreadSummary(parentMessageId) {
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
  parseTranslation,
};
