const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const auth = require('../../shared/middleware/auth');

router.use((req, res, next) => {
    logger.info(`🤖 AI Request: ${req.method} ${req.originalUrl}`);
    logger.info('Payload:', JSON.stringify(req.body).substring(0, 100)); 
    next();
});

router.post('/chat', auth, aiController.chat);
router.post('/summarize', auth, aiController.summarize);
router.post('/generate-task', auth, aiController.generateTask);

router.post('/summarize-document', auth, aiController.summarizeDocument);
router.post('/semantic-search',    auth, aiController.semanticSearch);
router.get('/cache-stats',         auth, aiController.cacheStats);

module.exports = router;
