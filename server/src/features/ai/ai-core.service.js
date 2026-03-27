// server/src/features/ai/ai-core.service.js
/**
 * AI Core — Central Hub
 *
 * Single facade consumed by all AI sub-modules (assistant, knowledge,
 * automation, insights).  Delegates to the existing ai.summarizer.service.js
 * which already has Gemini integration + TTL caching.
 *
 * Exports:
 *   summarize(text, opts)           – generic document summary
 *   extractTasks(text)              – action items as string[]
 *   answerQuestion(query, context)  – grounded Q&A
 *   generateReplies(context)        – 3 smart reply suggestions
 */

'use strict';

const { summarizeDocument, semanticSearch, cacheStats, clearCache } = require('./ai.summarizer.service');
const crypto = require('crypto');

// ─── Re-export base helpers ──────────────────────────────────────────────────
exports.summarize       = summarizeDocument;
exports.semanticSearch  = semanticSearch;
exports.cacheStats      = cacheStats;
exports.clearCache      = clearCache;

// ─── Shared cache (mirrors pattern in ai.summarizer.service) ─────────────────
const _cache = new Map();

function _cacheKey(...parts) {
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}
function _cacheGet(key) {
    const e = _cache.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { _cache.delete(key); return null; }
    return e.value;
}
function _cacheSet(key, value, ttlMs = 300_000) {
    _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ─── Gemini client (lazy) ─────────────────────────────────────────────────────
let _model = null;
function _getModel() {
    if (!_model) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
        _model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    return _model;
}

// ─── extractTasks ─────────────────────────────────────────────────────────────
/**
 * Extract action items from text.
 * @param   {string} text
 * @returns {Promise<{ items: string[], fallback: boolean }>}
 */
async function extractTasks(text) {
    if (!text || !text.trim()) return { items: [], fallback: false };

    const truncated = text.substring(0, 6_000);
    const key = _cacheKey('extractTasks', truncated);
    const cached = _cacheGet(key);
    if (cached) return { items: cached, cached: true, fallback: false };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
        // Static fallback — try regex heuristics
        const lines = truncated.split(/[\n.!?]+/).filter(l => /\b(will|should|must|need to|todo|review|fix|create|update|complete|finish|send|schedule|assign)\b/i.test(l)).slice(0, 5).map(l => l.trim()).filter(Boolean);
        return { items: lines.length ? lines : ['No action items detected'], fallback: true };
    }

    try {
        const prompt = [
            'Extract all explicit action items and tasks from the text below.',
            'Return a valid JSON array of short strings (each ≤ 15 words), nothing else.',
            'If there are no action items return an empty array [].',
            '',
            `Text:\n${truncated}`,
        ].join('\n');

        const result = await _getModel().generateContent(prompt);
        let raw = result.response.text().trim().replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) throw new Error('Not an array');

        _cacheSet(key, items, 300_000);
        return { items, fallback: false };
    } catch (err) {
        console.error('[AICore] extractTasks error:', err.message);
        return { items: [], fallback: true };
    }
}
exports.extractTasks = extractTasks;

// ─── answerQuestion ───────────────────────────────────────────────────────────
/**
 * Answer a user question using provided context documents.
 * @param   {string}   query
 * @param   {Array<{title:string, content:string}>} contextDocs
 * @returns {Promise<{ answer: string, fallback: boolean }>}
 */
async function answerQuestion(query, contextDocs = []) {
    if (!query) return { answer: 'Please provide a question.', fallback: true };

    const contextText = contextDocs.map((d, i) =>
        `[Source ${i + 1}] ${d.title || 'Document'}\n${(d.content || '').substring(0, 1_500)}`
    ).join('\n\n---\n\n').substring(0, 10_000);

    const key = _cacheKey('answerQuestion', query, contextText.substring(0, 200));
    const cached = _cacheGet(key);
    if (cached) return { answer: cached, cached: true, fallback: false };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
        return { answer: 'AI service not configured. Please set GEMINI_API_KEY.', fallback: true };
    }

    try {
        const prompt = [
            'You are a helpful workspace assistant. Answer the question using ONLY the provided context.',
            'Be concise and factual. If the answer is not in the context, say "I don\'t have enough information to answer that."',
            '',
            `Context:\n${contextText || 'No context provided.'}`,
            '',
            `Question: ${query}`,
        ].join('\n');

        const result = await _getModel().generateContent(prompt);
        const answer = result.response.text().trim();
        _cacheSet(key, answer, 300_000);
        return { answer, fallback: false };
    } catch (err) {
        console.error('[AICore] answerQuestion error:', err.message);
        return { answer: 'I was unable to find an answer. Please try again.', fallback: true };
    }
}
exports.answerQuestion = answerQuestion;

// ─── generateReplies ──────────────────────────────────────────────────────────
/**
 * Generate 3 short smart reply suggestions for a conversation.
 * @param   {Array<{sender:string, text:string}>} messages  Last few messages
 * @returns {Promise<{ suggestions: string[], fallback: boolean }>}
 */
async function generateReplies(messages = []) {
    const FALLBACKS = [
        ['👍 Got it!', 'Thanks for the update!', 'Will do!'],
        ['Sounds great!', 'I\'ll check it out', 'On it!'],
        ['Thanks!', 'Noted 👍', 'Makes sense!'],
    ];

    if (!messages.length) {
        return { suggestions: FALLBACKS[0], fallback: true };
    }

    const recent = messages.slice(-5);
    const transcript = recent.map(m => `${m.sender || 'User'}: ${m.text || ''}`).join('\n');
    const key = _cacheKey('generateReplies', transcript);
    const cached = _cacheGet(key);
    if (cached) return { suggestions: cached, cached: true, fallback: false };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
        return { suggestions: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)], fallback: true };
    }

    try {
        const prompt = [
            'You are a smart reply assistant for a team chat app.',
            'Given the conversation below, generate exactly 3 short, natural reply suggestions (max 8 words each).',
            'Return ONLY a JSON array of 3 strings, nothing else.',
            '',
            `Conversation:\n${transcript}`,
        ].join('\n');

        const result = await _getModel().generateContent(prompt);
        let raw = result.response.text().trim().replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
        const suggestions = JSON.parse(raw);
        if (!Array.isArray(suggestions) || suggestions.length < 3) throw new Error('Invalid format');

        const final = suggestions.slice(0, 3).map(String);
        _cacheSet(key, final, 120_000);
        return { suggestions: final, fallback: false };
    } catch (err) {
        console.error('[AICore] generateReplies error:', err.message);
        return { suggestions: FALLBACKS[0], fallback: true };
    }
}
exports.generateReplies = generateReplies;
