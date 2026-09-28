'use strict';

/**
 * /api/ai — Oruinwan Intelligence.
 *
 * Every route: JWT auth → per-user rate limit → workspace membership + AI
 * enabled (requireAIAccess) → controller → ai gateway. Routes marked
 * `optional` work without a workspace (personal use, SDK).
 */
const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const { aiLimiter, requireAIAccess } = require('./ai.access');
const c = require('./ai.controller');

router.use(auth, aiLimiter);

const member = requireAIAccess();
const optional = requireAIAccess({ optional: true });
const admin = requireAIAccess({ adminOnly: true });

// Assistant
router.post('/chat', optional, c.chat);
router.post('/chat/stream', optional, c.chatStream);
// Mentioned in a channel / DM / thread: reply there, streamed live to everyone
router.post('/reply', member, c.reply);
router.post('/memory/clear', optional, c.clearMemory);

// Personal memory: what Oruinwan AI remembers about the signed-in user
router.get('/memories', optional, c.listMemories);
router.post('/memories', optional, c.addMemory);
router.patch('/memories/:id', c.updateMemory);
router.delete('/memories/:id', c.deleteMemory);
router.delete('/memories', c.clearMemories);

// In-app actions (plaintext is decrypted by the client and sent here)
router.post('/smart-replies', member, c.smartReplies);
router.post('/translate', optional, c.translate);
router.post('/draft', optional, c.draft);
router.post('/conversation', member, c.conversation);
router.post('/extract-tasks', member, c.extractTasks);
router.post('/notes/assist', optional, c.noteAssist);
router.post('/tasks/assist', optional, c.taskAssist);
router.post('/summarize', optional, c.summarize);
router.post('/generate-task', optional, c.generateTask);

// Documents / search helpers
router.post('/summarize-document', optional, c.summarizeDocument);
router.post('/semantic-search', optional, c.semanticSearch);
router.get('/cache-stats', c.cacheStats);

// Configuration
router.get('/capabilities', c.capabilities);
router.get('/settings', member, c.getSettings);
router.put('/settings', admin, c.updateSettings);
router.post('/settings/test', admin, c.testProvider);
router.get('/usage', member, c.usage);

module.exports = router;
