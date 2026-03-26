// server/src/features/ai/ai.summarizer.service.js
/**
 * AI Summarizer Service — Phase 3: Backend AI Layer
 *
 * Provides two public methods consumed by the knowledge system:
 *   • summarizeDocument(text, opts)   — generates a concise summary via Gemini
 *   • semanticSearch(query, docs)     — ranks/filters docs by semantic relevance
 *
 * Both functions are backed by a lightweight in-memory TTL cache so repeated
 * calls with the same input skip the LLM entirely.
 *
 * Architecture note:
 *   Services / controllers are the callers.  This file is framework-agnostic;
 *   it does NOT import Express, Socket.IO, or any DB model.  All I/O aside from
 *   the Gemini API is done by the caller.
 */

'use strict';

const crypto = require('crypto');

// ─── Gemini client (lazy-initialised so the server starts even without a key) ─

let _genAI = null;

function getGenAI() {
    if (!_genAI) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
        if (!apiKey) {
            console.warn('[AISummarizer] ⚠️  No Gemini API key found — AI calls will use fallback.');
        }
        _genAI = new GoogleGenerativeAI(apiKey);
    }
    return _genAI;
}

function getModel(modelName = 'gemini-1.5-flash') {
    return getGenAI().getGenerativeModel({ model: modelName });
}

// ─── In-memory TTL Cache ──────────────────────────────────────────────────────
//
// Simple Map-based cache.  Each entry is { value, expiresAt }.
// No external dependency (redis / memcached) needed for a single-process server.
// For a clustered deployment, replace this with a shared cache (Redis).

const _cache = new Map();

/**
 * Build a deterministic cache key from arbitrary inputs.
 * @param {...string} parts
 * @returns {string}
 */
function _cacheKey(...parts) {
    return crypto
        .createHash('sha256')
        .update(parts.join('|'))
        .digest('hex');
}

/**
 * Read from cache.
 * @param {string} key
 * @returns {*|null}  Cached value or null if missing / expired.
 */
function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Write to cache.
 * @param {string} key
 * @param {*}      value
 * @param {number} [ttlMs=600_000]  TTL in milliseconds (default 10 min).
 */
function _cacheSet(key, value, ttlMs = 600_000) {
    _cache.set(key, { value, expiresAt: Date.now() + ttlMs });

    // Lazy eviction: prune expired keys once the cache grows large.
    if (_cache.size > 500) {
        const now = Date.now();
        for (const [k, v] of _cache) {
            if (now > v.expiresAt) _cache.delete(k);
        }
    }
}

/** Expose cache stats for monitoring / health-check endpoints. */
function cacheStats() {
    const now = Date.now();
    let alive = 0;
    for (const v of _cache.values()) {
        if (now <= v.expiresAt) alive++;
    }
    return { total: _cache.size, alive, expired: _cache.size - alive };
}

/** Manually clear the entire cache (useful in tests or admin endpoints). */
function clearCache() {
    _cache.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * summarizeDocument(text, opts)
 *
 * Generates a 2–4 sentence plain-text summary of any document or wiki page.
 *
 * @param {string} text        The raw text / Markdown content to summarise.
 *                             Content beyond 8 000 chars is truncated before
 *                             sending to the model.
 * @param {object} [opts]
 * @param {string}  [opts.title]    Optional document title — improves summary quality.
 * @param {string}  [opts.type]     Optional hint: 'wiki'|'file'|'note'|'generic' (default 'generic').
 * @param {number}  [opts.ttlMs]    Cache TTL override in ms (default 10 min).
 * @param {boolean} [opts.noCache]  Set true to always call the LLM (bypasses read + write).
 *
 * @returns {Promise<{ summary: string, cached: boolean, fallback: boolean }>}
 */
async function summarizeDocument(text, opts = {}) {
    const { title = '', type = 'generic', ttlMs = 600_000, noCache = false } = opts;

    const truncated = (text || '').substring(0, 8_000);
    const cKey = _cacheKey('summarize', title, truncated);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { summary: hit, cached: true, fallback: false };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    // ── Fallback: no API key ──────────────────────────────────────────────────
    if (!apiKey || !truncated.trim()) {
        const fallbackText = truncated
            .replace(/[#*>`_\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
        const summary = fallbackText
            ? fallbackText + (truncated.length > 300 ? ' …' : '')
            : 'No content to summarise.';
        if (!noCache) _cacheSet(cKey, summary, ttlMs);
        return { summary, cached: false, fallback: true };
    }

    // ── Gemini call ───────────────────────────────────────────────────────────
    try {
        const typeHint = type !== 'generic'
            ? `This is a ${type} document.  `
            : '';

        const prompt = [
            `You are a concise technical writer.  ${typeHint}`,
            `Summarise the following content in 2–4 clear, informative sentences.`,
            `Return ONLY the summary — no bullet points, no headings, no formatting.`,
            title ? `\nDocument title: ${title}` : '',
            `\n---\n${truncated}`,
        ].join('');

        const model = getModel('gemini-1.5-flash');
        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        if (!noCache) _cacheSet(cKey, summary, ttlMs);
        return { summary, cached: false, fallback: false };

    } catch (err) {
        console.error('[AISummarizer] summarizeDocument error:', err.message);

        // Graceful degradation: extract first 300 chars as summary.
        const fallbackText = truncated
            .replace(/[#*>`_\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
        const summary = fallbackText
            ? fallbackText + (truncated.length > 300 ? ' …' : '')
            : 'Summary unavailable.';

        // Cache for a shorter TTL so we retry sooner after a transient error.
        if (!noCache) _cacheSet(cKey, summary, Math.min(ttlMs, 60_000));
        return { summary, cached: false, fallback: true };
    }
}

/**
 * semanticSearch(query, docs, opts)
 *
 * Ranks an array of document snippets by semantic relevance to `query`.
 * Gemini is used to score each document; results are sorted descending by score.
 *
 * For large collections, pass a pre-filtered `docs` array (≤ 20 items).
 * Mongo FTS should be the first-pass filter; this is the re-ranking step.
 *
 * @param {string}   query     The user's search query.
 * @param {Array<{id: string, title: string, snippet: string}>} docs
 *        Array of candidate documents.  Each must have: id, title, snippet.
 *
 * @param {object}  [opts]
 * @param {number}   [opts.topK=10]     Return at most this many results.
 * @param {number}   [opts.ttlMs=300_000]  Cache TTL (default 5 min).
 * @param {boolean}  [opts.noCache=false]
 *
 * @returns {Promise<{ results: Array<{id, title, snippet, score}>, cached: boolean }>}
 */
async function semanticSearch(query, docs, opts = {}) {
    const { topK = 10, ttlMs = 300_000, noCache = false } = opts;

    if (!query || !docs || docs.length === 0) {
        return { results: [], cached: false };
    }

    // Stable cache key: hash of query + stable doc ids
    const docIds = docs.map(d => d.id).sort().join(',');
    const cKey = _cacheKey('semantic', query, docIds);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { results: hit, cached: true };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    // ── Fallback: no API key — return original order ──────────────────────────
    if (!apiKey) {
        const results = docs.slice(0, topK).map((d, i) => ({ ...d, score: 1 - i * 0.05 }));
        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };
    }

    // ── Gemini call ───────────────────────────────────────────────────────────
    try {
        const docList = docs.map((d, i) =>
            `[${i}] ID:${d.id}\nTitle: ${d.title}\nSnippet: ${(d.snippet || '').substring(0, 300)}`
        ).join('\n\n');

        const prompt = [
            `You are a search-relevance engine.`,
            `Given the query and the list of documents below, return a JSON array of objects`,
            `with keys "index" (the bracket number) and "score" (0.0–1.0, higher = more relevant).`,
            `Include ALL documents.  Return ONLY valid JSON — no prose, no markdown fences.`,
            ``,
            `Query: "${query}"`,
            ``,
            `Documents:`,
            docList,
        ].join('\n');

        const model = getModel('gemini-1.5-flash');
        const result = await model.generateContent(prompt);
        let rawJson = result.response.text().trim();

        // Strip markdown fences the model sometimes includes.
        rawJson = rawJson.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();

        const scored = JSON.parse(rawJson); // [{ index, score }, ...]

        const results = scored
            .map(s => ({ ...docs[s.index], score: parseFloat(s.score) || 0 }))
            .filter(d => d.id)                        // guard against bad indices
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };

    } catch (err) {
        console.error('[AISummarizer] semanticSearch error:', err.message);

        // Fallback: return original order with uniform scores.
        const results = docs.slice(0, topK).map((d, i) => ({ ...d, score: 1 - i * 0.05 }));
        if (!noCache) _cacheSet(cKey, results, Math.min(ttlMs, 60_000));
        return { results, cached: false };
    }
}

// ─── Module exports ───────────────────────────────────────────────────────────

module.exports = {
    summarizeDocument,
    semanticSearch,
    cacheStats,
    clearCache,
};
