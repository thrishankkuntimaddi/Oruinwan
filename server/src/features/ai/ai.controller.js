/**
 * server/src/features/ai/ai.controller.js
 *
 * AI Controller — Transport / Delegate Layer
 *
 * Architecture (Phase 3B):
 *   client → server route (/api/ai/*) → ai.controller.js (this file)
 *                                      → ai/api/ai.gateway.js
 *                                      → AI orchestrator / agents / memory
 *
 * DESIGN RULES:
 *   - This file is a pure transport layer. No AI logic lives here.
 *   - It unpacks HTTP req/res and delegates to the AI gateway.
 *   - The gateway is framework-agnostic and testable in isolation.
 *   - Activity events are emitted here after gateway responses so the
 *     gateway stays free of Express/Socket.IO coupling.
 */

'use strict';

const gateway = require('../../../../ai/api/ai.gateway');
const activityService = require('../../features/activity/activity.service');
const aiSummarizer = require('./ai.summarizer.service');

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// ---------------------------------------------------------------------------
exports.chat = async (req, res) => {
  try {
    console.log('➡️  [AI Controller] Delegating chat → AI Gateway');

    const { message, history, workspaceId } = req.body;
    const userId = req.user.sub;

    const result = await gateway.chat(
      { message, history, workspaceId },
      { userId, req }
    );

    // Emit activity event (fire-and-forget, never blocks response)
    activityService.emit(req, {
      type: 'ai',
      subtype: 'chat',
      workspaceId: workspaceId || null,
      actor: userId,
      payload: { prompt: message, response: result.text?.substring(0, 200) },
    }).catch(() => {}); // silent — activity is non-critical

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ [AI Controller] chat error:', error);
    return res.status(500).json({
      message: 'AI Service Unavailable',
      error: error.message,
      details: error.toString(),
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/summarize
// ---------------------------------------------------------------------------
exports.summarize = async (req, res) => {
  try {
    console.log('➡️  [AI Controller] Delegating summarize → AI Gateway');

    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'No text provided' });

    const result = await gateway.summarize({ text }, { userId: req.user.sub });

    // Emit activity event
    activityService.emit(req, {
      type: 'ai',
      subtype: 'summary',
      workspaceId: req.body.workspaceId || null,
      actor: req.user.sub,
      payload: { summary: result.summary?.substring(0, 200) },
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ [AI Controller] summarize error:', error);
    return res.status(500).json({ message: 'Summarization Failed', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/generate-task
// ---------------------------------------------------------------------------
exports.generateTask = async (req, res) => {
  try {
    console.log('➡️  [AI Controller] Delegating generateTask → AI Gateway');

    const { context } = req.body;
    const result = await gateway.generateTask({ context }, { userId: req.user.sub });

    // Emit activity event
    activityService.emit(req, {
      type: 'ai',
      subtype: 'task_generated',
      workspaceId: req.body.workspaceId || null,
      actor: req.user.sub,
      payload: { title: result.title, priority: result.priority },
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ [AI Controller] generateTask error:', error);
    return res.status(500).json({ message: 'Task Generation Failed', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/summarize-document
// Summarise any raw text or document content with TTL caching.
// ---------------------------------------------------------------------------
exports.summarizeDocument = async (req, res) => {
  try {
    const { text, title, type, noCache } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });

    const result = await aiSummarizer.summarizeDocument(text, { title, type, noCache });
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ [AI Controller] summarizeDocument error:', error);
    return res.status(500).json({ message: 'Summarization failed', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/semantic-search
// Re-rank candidate docs by semantic relevance to query.
// ---------------------------------------------------------------------------
exports.semanticSearch = async (req, res) => {
  try {
    const { query, docs, topK, noCache } = req.body;
    if (!query) return res.status(400).json({ message: 'query is required' });
    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({ message: 'docs must be a non-empty array' });
    }

    const result = await aiSummarizer.semanticSearch(query, docs, { topK, noCache });
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ [AI Controller] semanticSearch error:', error);
    return res.status(500).json({ message: 'Semantic search failed', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ai/cache-stats  (admin/debug — returns in-memory cache metrics)
// ---------------------------------------------------------------------------
exports.cacheStats = async (_req, res) => {
  return res.status(200).json(aiSummarizer.cacheStats());
};
