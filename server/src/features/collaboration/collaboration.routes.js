'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Whiteboard = require('./whiteboard.model');
const Brainstorm = require('./brainstorm.model');
const WhiteboardPage = require('./whiteboardPage.model');
const logger = require('../../../utils/logger');
const { requireMeetingAccess } = require('../meetings/meetingAccess');
const { isValidId } = require('../../shared/utils/workspaceAccess');

router.use(requireAuth);

// Every board belongs to a scheduled meeting: the caller must be an active
// member of that meeting's workspace (400 malformed id, 404, 403). The
// workspaceId stored on a board always comes from the meeting, never the body.
router.use('/whiteboard/:meetingId', requireMeetingAccess('meetingId'));
router.use('/brainstorm/:meetingId', requireMeetingAccess('meetingId'));

function requireItemId(req, res, next) {
    if (!isValidId(req.params.itemId)) return res.status(400).json({ message: 'Invalid item id' });
    next();
}

function badRequest(err, res) {
    if (err && (err.name === 'ValidationError' || err.name === 'CastError')) {
        res.status(400).json({ message: err.name === 'CastError' ? 'Invalid input' : err.message });
        return true;
    }
    return false;
}

// ── Whiteboard pages ────────────────────────────────────────────────────────
// Page 1 is the meeting's board (GET/POST /whiteboard/:meetingId); these are pages 2, 3, …
//   GET    /whiteboard/:meetingId/pages             → { pages: [{ id, title, order }] }  (page 1 is { id: meetingId })
//   POST   /whiteboard/:meetingId/pages  { title? } → { page }
//   PATCH  /whiteboard/:meetingId/pages/:pageId { title }
//   DELETE /whiteboard/:meetingId/pages/:pageId
//   GET    /whiteboard/:meetingId/pages/:pageId     → { strokes }
//   POST   /whiteboard/:meetingId/pages/:pageId { strokes }
const MAX_PAGES = 30;
const pageShape = (p) => ({ id: String(p._id), title: p.title || '', order: p.order || 0 });

async function loadPage(req, res) {
    if (!isValidId(req.params.pageId)) { res.status(400).json({ message: 'Invalid page id' }); return null; }
    const page = await WhiteboardPage.findOne({ _id: req.params.pageId, meetingId: req.params.meetingId });
    if (!page) { res.status(404).json({ message: 'Page not found' }); return null; }
    return page;
}

router.get('/whiteboard/:meetingId/pages', async (req, res) => {
    try {
        const pages = await WhiteboardPage.find({ meetingId: req.params.meetingId }).select('_id title order').sort({ order: 1, createdAt: 1 }).lean();
        res.json({ pages: [{ id: String(req.params.meetingId), title: 'Page 1', order: 0 }, ...pages.map((p, i) => ({ ...pageShape(p), title: p.title || `Page ${i + 2}` }))] });
    } catch (err) {
        logger.error('[Collaboration] GET whiteboard pages error:', err);
        res.status(500).json({ message: 'Failed to load pages' });
    }
});

router.post('/whiteboard/:meetingId/pages', async (req, res) => {
    try {
        const count = await WhiteboardPage.countDocuments({ meetingId: req.params.meetingId });
        if (count >= MAX_PAGES - 1) return res.status(409).json({ message: `A whiteboard can have up to ${MAX_PAGES} pages` });
        const last = await WhiteboardPage.findOne({ meetingId: req.params.meetingId }).sort({ order: -1 }).select('order').lean();
        const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
        const page = await WhiteboardPage.create({ meetingId: req.params.meetingId, workspaceId: req.meeting.workspaceId, title: title || `Page ${count + 2}`, order: (last?.order || 0) + 1, strokes: [] });
        req.io?.to(`meeting:${req.params.meetingId}`).emit('whiteboard:pages', { meetingId: req.params.meetingId });
        res.status(201).json({ page: pageShape(page) });
    } catch (err) {
        if (badRequest(err, res)) return;
        logger.error('[Collaboration] POST whiteboard page error:', err);
        res.status(500).json({ message: 'Failed to add a page' });
    }
});

router.patch('/whiteboard/:meetingId/pages/:pageId', async (req, res) => {
    try {
        const page = await loadPage(req, res);
        if (!page) return;
        if (typeof req.body?.title === 'string') page.title = req.body.title.trim().slice(0, 80);
        await page.save();
        req.io?.to(`meeting:${req.params.meetingId}`).emit('whiteboard:pages', { meetingId: req.params.meetingId });
        res.json({ page: pageShape(page) });
    } catch (err) {
        logger.error('[Collaboration] PATCH whiteboard page error:', err);
        res.status(500).json({ message: 'Failed to rename the page' });
    }
});

router.delete('/whiteboard/:meetingId/pages/:pageId', async (req, res) => {
    try {
        const page = await loadPage(req, res);
        if (!page) return;
        await WhiteboardPage.deleteOne({ _id: page._id });
        await require('../../modules/collab/collab.service').documentDeleted?.('whiteboard', String(page._id));
        req.io?.to(`meeting:${req.params.meetingId}`).emit('whiteboard:pages', { meetingId: req.params.meetingId });
        res.json({ ok: true });
    } catch (err) {
        logger.error('[Collaboration] DELETE whiteboard page error:', err);
        res.status(500).json({ message: 'Failed to delete the page' });
    }
});

router.get('/whiteboard/:meetingId/pages/:pageId', async (req, res) => {
    try {
        const page = await loadPage(req, res);
        if (!page) return;
        res.json({ strokes: page.strokes || [] });
    } catch (err) {
        logger.error('[Collaboration] GET whiteboard page error:', err);
        res.status(500).json({ message: 'Failed to load the page' });
    }
});

router.post('/whiteboard/:meetingId/pages/:pageId', async (req, res) => {
    try {
        const { strokes = [] } = req.body || {};
        if (!Array.isArray(strokes)) return res.status(400).json({ message: 'strokes must be an array' });
        const page = await loadPage(req, res);
        if (!page) return;
        page.strokes = strokes;
        await page.save();
        await require('../../modules/collab/collab.service').contentChanged('whiteboard', String(page._id), page.strokes, { workspaceId: String(req.meeting.workspaceId) });
        res.json({ strokes: page.strokes });
    } catch (err) {
        if (badRequest(err, res)) return;
        logger.error('[Collaboration] POST whiteboard page error:', err);
        res.status(500).json({ message: 'Failed to save the page' });
    }
});

router.get('/whiteboard/:meetingId', async (req, res) => {
    try {
        const wb = await Whiteboard.findOne({ meetingId: req.params.meetingId }).lean();
        res.json({ strokes: wb?.strokes || [] });
    } catch (err) {
        logger.error('[Collaboration] GET whiteboard error:', err);
        res.status(500).json({ message: 'Failed to load whiteboard' });
    }
});

router.post('/whiteboard/:meetingId', async (req, res) => {
    try {
        const { strokes = [] } = req.body || {};
        if (!Array.isArray(strokes)) return res.status(400).json({ message: 'strokes must be an array' });
        const workspaceId = req.meeting.workspaceId;
        const wb = await Whiteboard.findOneAndUpdate(
            { meetingId: req.params.meetingId },
            { meetingId: req.params.meetingId, workspaceId, strokes },
            { upsert: true, new: true }
        );
        // Live boards (collab:* sockets) pick the replacement up as an ordinary update.
        await require('../../modules/collab/collab.service').contentChanged('whiteboard', req.params.meetingId, wb.strokes, { workspaceId: String(workspaceId) });
        res.json({ strokes: wb.strokes });
    } catch (err) {
        if (badRequest(err, res)) return;
        logger.error('[Collaboration] POST whiteboard error:', err);
        res.status(500).json({ message: 'Failed to save whiteboard' });
    }
});

router.get('/brainstorm/:meetingId', async (req, res) => {
    try {
        const board = await Brainstorm.findOne({ meetingId: req.params.meetingId }).lean();
        res.json({ items: board?.items || [] });
    } catch (err) {
        logger.error('[Collaboration] GET brainstorm error:', err);
        res.status(500).json({ message: 'Failed to load brainstorm board' });
    }
});

router.post('/brainstorm/:meetingId', async (req, res) => {
    try {
        const { text, position, color } = req.body || {};
        const workspaceId = req.meeting.workspaceId;
        if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ message: 'text is required' });

        const item = {
            text,
            position: position || { x: 100, y: 100 },
            color: color || '#FBBF24',
            createdBy: req.user.sub,
        };

        const board = await Brainstorm.findOneAndUpdate(
            { meetingId: req.params.meetingId },
            { $setOnInsert: { workspaceId }, $push: { items: item } },
            { upsert: true, new: true }
        );

        const newItem = board.items[board.items.length - 1];

        
        req.io.to(`meeting:${req.params.meetingId}`).emit('brainstorm:update', {
            meetingId: req.params.meetingId,
            action: 'add',
            item: newItem,
        });

        res.status(201).json({ item: newItem });
    } catch (err) {
        if (badRequest(err, res)) return;
        logger.error('[Collaboration] POST brainstorm error:', err);
        res.status(500).json({ message: 'Failed to add brainstorm item' });
    }
});

router.patch('/brainstorm/:meetingId/:itemId', requireItemId, async (req, res) => {
    try {
        const setPayload = {};
        const { position, text, color } = req.body || {};
        if (position) {
            setPayload['items.$.position.x'] = position.x;
            setPayload['items.$.position.y'] = position.y;
        }
        if (text !== undefined) setPayload['items.$.text'] = text;
        if (color !== undefined) setPayload['items.$.color'] = color;
        if (Object.keys(setPayload).length === 0) return res.status(400).json({ message: 'Nothing to update' });

        const board = await Brainstorm.findOneAndUpdate(
            { meetingId: req.params.meetingId, 'items._id': req.params.itemId },
            { $set: setPayload },
            { new: true }
        );
        if (!board) return res.status(404).json({ message: 'Item not found' });

        const updatedItem = board.items.find(i => i._id.toString() === req.params.itemId);

        req.io.to(`meeting:${req.params.meetingId}`).emit('brainstorm:update', {
            meetingId: req.params.meetingId,
            action: 'update',
            item: updatedItem,
        });

        res.json({ item: updatedItem });
    } catch (err) {
        if (badRequest(err, res)) return;
        logger.error('[Collaboration] PATCH brainstorm error:', err);
        res.status(500).json({ message: 'Failed to update brainstorm item' });
    }
});

router.delete('/brainstorm/:meetingId/:itemId', requireItemId, async (req, res) => {
    try {
        await Brainstorm.findOneAndUpdate(
            { meetingId: req.params.meetingId },
            { $pull: { items: { _id: req.params.itemId } } }
        );

        req.io.to(`meeting:${req.params.meetingId}`).emit('brainstorm:update', {
            meetingId: req.params.meetingId,
            action: 'delete',
            itemId: req.params.itemId,
        });

        res.json({ message: 'Item deleted' });
    } catch (err) {
        logger.error('[Collaboration] DELETE brainstorm error:', err);
        res.status(500).json({ message: 'Failed to delete brainstorm item' });
    }
});

module.exports = router;
