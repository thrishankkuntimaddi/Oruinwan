const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const auth = require('../../../middleware/auth');

// Debug Middleware
router.use((req, res, next) => {
    console.log(`🤖 AI Request: ${req.method} ${req.originalUrl}`);
    console.log('Payload:', JSON.stringify(req.body).substring(0, 100)); // Log first 100 chars
    next();
});

// All AI routes usually require authentication
router.post('/chat', auth, aiController.chat);
router.post('/summarize', auth, aiController.summarize);
router.post('/generate-task', auth, aiController.generateTask);

// Phase 3 — document summarisation + semantic re-ranking
router.post('/summarize-document', auth, aiController.summarizeDocument);
router.post('/semantic-search',    auth, aiController.semanticSearch);
router.get('/cache-stats',         auth, aiController.cacheStats);

module.exports = router;
