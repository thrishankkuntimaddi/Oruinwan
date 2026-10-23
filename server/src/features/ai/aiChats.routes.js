'use strict';

/**
 * /api/ai/chats — the AI panel's conversation history, per person and workspace.
 * Mounted before /api/ai so saving history doesn't count against the AI request limit.
 *
 *   GET    /?workspaceId=          → { chats: [{ id, title, assistant, messageCount, preview, updatedAt }] }
 *   GET    /:id?workspaceId=       → { chat: { …, messages: [{ role, text, at }] } }
 *   PUT    /:id  { workspaceId, title?, assistant?, messages }  → { chat } (create or replace)
 *   PATCH  /:id  { workspaceId, title }                         → { chat }
 *   DELETE /:id?workspaceId=       → { ok }
 *   DELETE /?workspaceId=          → { deleted }
 */
const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../shared/middleware/auth');
const identity = require('../../identity');
const chats = require('./aiChats.service');
const logger = require('../../../utils/logger');

const router = express.Router();
router.use(auth);

// The caller must be a member of the workspace the history belongs to.
router.use(async (req, res, next) => {
    try {
        const workspaceId = req.body?.workspaceId || req.query?.workspaceId;
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(String(workspaceId))) {
            return res.status(400).json({ message: 'workspaceId is required' });
        }
        const ws = await identity.workspaces.findById(workspaceId, { activeOnly: true });
        const member = ws && (ws.members || []).some((m) => String(m.user?._id || m.user) === String(req.user.sub) && m.status !== 'removed');
        if (!member) return res.status(403).json({ message: 'You are not a member of this workspace', code: 'WORKSPACE_ACCESS_DENIED' });
        req.historyWorkspace = String(workspaceId);
        return next();
    } catch (err) {
        return next(err);
    }
});

const validId = (req, res, next) => (chats.isChatId(req.params.id) ? next() : res.status(400).json({ message: 'Invalid conversation id' }));

const wrap = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        logger.error({ err }, '[AI history] request failed');
        res.status(500).json({ message: 'Could not load or save your AI conversations' });
    }
};

router.get('/', wrap(async (req, res) => {
    res.json({ chats: await chats.list(req.user.sub, req.historyWorkspace) });
}));

router.get('/:id', validId, wrap(async (req, res) => {
    const chat = await chats.get(req.user.sub, req.historyWorkspace, req.params.id);
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });
    return res.json({ chat });
}));

router.put('/:id', validId, wrap(async (req, res) => {
    const chat = await chats.save(req.user.sub, req.historyWorkspace, req.params.id, req.body);
    if (!chat) return res.status(400).json({ message: 'A conversation needs at least one message' });
    return res.json({ chat });
}));

router.patch('/:id', validId, wrap(async (req, res) => {
    const chat = await chats.rename(req.user.sub, req.historyWorkspace, req.params.id, req.body?.title);
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });
    return res.json({ chat });
}));

router.delete('/:id', validId, wrap(async (req, res) => {
    res.json({ ok: await chats.remove(req.user.sub, req.historyWorkspace, req.params.id) });
}));

router.delete('/', wrap(async (req, res) => {
    res.json({ deleted: await chats.clear(req.user.sub, req.historyWorkspace) });
}));

module.exports = router;
