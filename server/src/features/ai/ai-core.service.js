'use strict';

/**
 * Thin server-side facade over the AI gateway for feature modules that need
 * one-shot helpers (knowledge Q&A, automation, meetings). No vendor SDKs here.
 */
const logger = require('../../../utils/logger');
const gateway = require('../../../../ai/api/ai.gateway');
const { summarizeDocument, semanticSearch, cacheStats, clearCache } = require('./ai.summarizer.service');

exports.summarize = summarizeDocument;
exports.semanticSearch = semanticSearch;
exports.cacheStats = cacheStats;
exports.clearCache = clearCache;

const sys = (context = {}) => ({ userId: context.userId || 'system', ...context });

/** @returns {Promise<{ items: string[], tasks: Array, fallback: boolean }>} */
async function extractTasks(text, context = {}) {
    if (!text || !String(text).trim()) return { items: [], tasks: [], fallback: false };
    try {
        const { tasks } = await gateway.extractTasks({ text: String(text).slice(0, 20_000) }, sys(context));
        return { items: tasks.map(t => t.title), tasks, fallback: false };
    } catch (err) {
        logger.warn('[AICore] extractTasks fallback:', err.message);
        const lines = String(text).split(/[\n.!?]+/)
            .filter(l => /\b(will|should|must|need to|todo|review|fix|create|update|complete|finish|send|schedule|assign)\b/i.test(l))
            .slice(0, 5).map(l => l.trim()).filter(Boolean);
        return { items: lines, tasks: lines.map(title => ({ title, description: '', priority: 'medium' })), fallback: true };
    }
}
exports.extractTasks = extractTasks;

/** @returns {Promise<{ answer: string, fallback: boolean }>} */
async function answerQuestion(query, contextDocs = [], context = {}) {
    if (!query) return { answer: 'Please provide a question.', fallback: true };
    try {
        const { answer } = await gateway.answer({ question: query, sources: contextDocs }, sys(context));
        return { answer, fallback: false };
    } catch (err) {
        logger.warn('[AICore] answerQuestion fallback:', err.message);
        return { answer: err.code === 'AI_NOT_CONFIGURED' ? 'AI is not configured yet.' : 'I was unable to find an answer. Please try again.', fallback: true };
    }
}
exports.answerQuestion = answerQuestion;

/** @returns {Promise<{ suggestions: string[], fallback: boolean }>} */
async function generateReplies(messages = [], context = {}) {
    if (!messages.length) return { suggestions: [], fallback: true };
    try {
        const { suggestions } = await gateway.smartReplies({ messages }, sys(context));
        return { suggestions, fallback: false };
    } catch (err) {
        logger.warn('[AICore] generateReplies fallback:', err.message);
        return { suggestions: [], fallback: true };
    }
}
exports.generateReplies = generateReplies;
