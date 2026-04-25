'use strict';

const crypto = require('crypto');

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

function getModel(modelName = 'gemini-2.0-flash') {
    return getGenAI().getGenerativeModel({ model: modelName });
}

const _cache = new Map();

function _cacheKey(...parts) {
    return crypto
        .createHash('sha256')
        .update(parts.join('|'))
        .digest('hex');
}

function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry.value;
}

function _cacheSet(key, value, ttlMs = 600_000) {
    _cache.set(key, { value, expiresAt: Date.now() + ttlMs });

    
    if (_cache.size > 500) {
        const now = Date.now();
        for (const [k, v] of _cache) {
            if (now > v.expiresAt) _cache.delete(k);
        }
    }
}

function cacheStats() {
    const now = Date.now();
    let alive = 0;
    for (const v of _cache.values()) {
        if (now <= v.expiresAt) alive++;
    }
    return { total: _cache.size, alive, expired: _cache.size - alive };
}

function clearCache() {
    _cache.clear();
}

async function summarizeDocument(text, opts = {}) {
    const { title = '', type = 'generic', ttlMs = 600_000, noCache = false } = opts;

    const truncated = (text || '').substring(0, 8_000);
    const cKey = _cacheKey('summarize', title, truncated);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { summary: hit, cached: true, fallback: false };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    
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

        const model = getModel('gemini-2.0-flash');
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

        
        if (!noCache) _cacheSet(cKey, summary, Math.min(ttlMs, 60_000));
        return { summary, cached: false, fallback: true };
    }
}

async function semanticSearch(query, docs, opts = {}) {
    const { topK = 10, ttlMs = 300_000, noCache = false } = opts;

    if (!query || !docs || docs.length === 0) {
        return { results: [], cached: false };
    }

    
    const docIds = docs.map(d => d.id).sort().join(',');
    const cKey = _cacheKey('semantic', query, docIds);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { results: hit, cached: true };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    
    if (!apiKey) {
        const results = docs.slice(0, topK).map((d, i) => ({ ...d, score: 1 - i * 0.05 }));
        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };
    }

    
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

        const model = getModel('gemini-2.0-flash');
        const result = await model.generateContent(prompt);
        let rawJson = result.response.text().trim();

        
        rawJson = rawJson.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();

        const scored = JSON.parse(rawJson); 

        const results = scored
            .map(s => ({ ...docs[s.index], score: parseFloat(s.score) || 0 }))
            .filter(d => d.id)                        
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };

    } catch (err) {
        console.error('[AISummarizer] semanticSearch error:', err.message);

        
        const results = docs.slice(0, topK).map((d, i) => ({ ...d, score: 1 - i * 0.05 }));
        if (!noCache) _cacheSet(cKey, results, Math.min(ttlMs, 60_000));
        return { results, cached: false };
    }
}

module.exports = {
    summarizeDocument,
    semanticSearch,
    cacheStats,
    clearCache,
};
