// server/src/features/knowledge/knowledge.controller.js
const knowledgeService = require('./knowledge.service');

function handleError(res, err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || 'Internal server error' });
}

async function getPages(req, res) {
    try {
        const { workspaceId, parentId, isHandbook, categoryId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.getPages(req.user.sub, workspaceId, { parentId, isHandbook, categoryId });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function createPage(req, res) {
    try {
        const { workspaceId } = req.body;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.createPage(req.user.sub, workspaceId, req.body);
        if (req.io) req.io.to(`workspace:${workspaceId}`).emit('knowledge:page_created', { page: result.page });
        return res.status(201).json(result);
    } catch (err) { return handleError(res, err); }
}

async function getPage(req, res) {
    try {
        const result = await knowledgeService.getPage(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function updatePage(req, res) {
    try {
        const result = await knowledgeService.updatePage(req.user.sub, req.params.id, req.body);
        if (req.io) req.io.to(`knowledge:${req.params.id}`).emit('knowledge:updated', { page: result.page });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function deletePage(req, res) {
    try {
        const result = await knowledgeService.deletePage(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function linkPages(req, res) {
    try {
        const { toPageId, workspaceId } = req.body;
        if (!toPageId || !workspaceId) return res.status(400).json({ message: 'toPageId and workspaceId required' });
        const result = await knowledgeService.linkPages(req.user.sub, req.params.id, toPageId, workspaceId);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function unlinkPages(req, res) {
    try {
        const result = await knowledgeService.unlinkPages(req.user.sub, req.params.id, req.params.toId);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getBacklinks(req, res) {
    try {
        const result = await knowledgeService.getBacklinks(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getGraph(req, res) {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.getGraph(req.user.sub, workspaceId);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function searchKnowledge(req, res) {
    try {
        const { workspaceId, q } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.searchKnowledge(req.user.sub, workspaceId, q || '');
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function summarizePage(req, res) {
    try {
        const result = await knowledgeService.generateSummary(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getCategories(req, res) {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.getCategories(workspaceId);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function createCategory(req, res) {
    try {
        const { workspaceId } = req.body;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledgeService.createCategory(req.user.sub, workspaceId, req.body);
        return res.status(201).json(result);
    } catch (err) { return handleError(res, err); }
}

module.exports = { getPages, createPage, getPage, updatePage, deletePage, linkPages, unlinkPages, getBacklinks, getGraph, searchKnowledge, summarizePage, getCategories, createCategory };
