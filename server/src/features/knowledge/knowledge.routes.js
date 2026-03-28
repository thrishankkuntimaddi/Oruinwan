// server/src/features/knowledge/knowledge.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./knowledge.controller');

router.use(requireAuth);

router.get('/pages', ctrl.getPages);
router.post('/pages', ctrl.createPage);
router.get('/pages/:id', ctrl.getPage);
router.put('/pages/:id', ctrl.updatePage);
router.delete('/pages/:id', ctrl.deletePage);
router.post('/pages/:id/link', ctrl.linkPages);
router.delete('/pages/:id/link/:toId', ctrl.unlinkPages);
router.get('/pages/:id/backlinks', ctrl.getBacklinks);
router.get('/graph', ctrl.getGraph);
router.get('/search', ctrl.searchKnowledge);
router.post('/pages/:id/summarize', ctrl.summarizePage);
router.get('/categories', ctrl.getCategories);
router.post('/categories', ctrl.createCategory);

module.exports = router;
