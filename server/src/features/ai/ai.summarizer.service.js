'use strict';
const logger = require('../../../utils/logger');

const crypto = require('crypto');

const gateway = require('../../../../ai/api/ai.gateway');
const sys = (context = {}) => ({ userId: context.userId || 'system', ...context });
const isConfigured = () => { try { return !!gateway.getOrchestrator().provider.isConfigured; } catch { return false; } };

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
    const { title = '', type = 'generic', ttlMs = 600_000, noCache = false, context = {} } = opts;

    const truncated = (text || '').substring(0, 8_000);
    const cKey = _cacheKey('summarize', title, truncated);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { summary: hit, cached: true, fallback: false };
    }

    if (!isConfigured() || !truncated.trim()) {
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

        const { summary } = await gateway.summarize({ text: truncated, style: 'brief', title: title || (type !== 'generic' ? `${type} document` : '') }, sys(context));

        if (!noCache) _cacheSet(cKey, summary, ttlMs);
        return { summary, cached: false, fallback: false };

    } catch (err) {
        logger.error('[AISummarizer] summarizeDocument error:', err.message);

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
    const { topK = 10, ttlMs = 300_000, noCache = false, context = {} } = opts;

    if (!query || !docs || docs.length === 0) {
        return { results: [], cached: false };
    }

    
    const docIds = docs.map(d => d.id).sort().join(',');
    const cKey = _cacheKey('semantic', query, docIds);

    if (!noCache) {
        const hit = _cacheGet(cKey);
        if (hit) return { results: hit, cached: true };
    }

    if (!isConfigured()) {
        const results = docs.slice(0, topK).map((d, i) => ({ ...d, score: 1 - i * 0.05 }));
        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };
    }

    
    try {
        const { scores } = await gateway.rerank({ query, docs: docs.map(d => ({ id: d.id, title: d.title, snippet: d.snippet })) }, sys(context));
        const results = docs
            .map((d, i) => ({ ...d, score: scores[i] || 0 }))
            .filter(d => d.id)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        if (!noCache) _cacheSet(cKey, results, ttlMs);
        return { results, cached: false };

    } catch (err) {
        logger.error('[AISummarizer] semanticSearch error:', err.message);

        
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
