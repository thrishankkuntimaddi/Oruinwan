'use strict';
// server/src/features/collaboration/collaboration.routes.js

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const Whiteboard = require('./whiteboard.model');
const Brainstorm = require('./brainstorm.model');
const logger = require('../../../utils/logger');

router.use(requireAuth);

// ─── Whiteboard ───────────────────────────────────────────────────────────────

// GET /api/v2/collaboration/whiteboard/:meetingId
router.get('/whiteboard/:meetingId', async (req, res) => {
    try {
        const wb = await Whiteboard.findOne({ meetingId: req.params.meetingId }).lean();
        res.json({ strokes: wb?.strokes || [] });
    } catch (err) {
        logger.error('[Collaboration] GET whiteboard error:', err);
        res.status(500).json({ message: 'Failed to load whiteboard' });
    }
});

// POST /api/v2/collaboration/whiteboard/:meetingId
// Body: { workspaceId, strokes: [...] }  — replaces all strokes (full snapshot)
router.post('/whiteboard/:meetingId', async (req, res) => {
    try {
        const { workspaceId, strokes = [] } = req.body;
        const wb = await Whiteboard.findOneAndUpdate(
            { meetingId: req.params.meetingId },
            { meetingId: req.params.meetingId, workspaceId, strokes },
            { upsert: true, new: true }
        );
        res.json({ strokes: wb.strokes });
    } catch (err) {
        logger.error('[Collaboration] POST whiteboard error:', err);
        res.status(500).json({ message: 'Failed to save whiteboard' });
    }
});

// ─── Brainstorm Board ─────────────────────────────────────────────────────────

// GET /api/v2/collaboration/brainstorm/:meetingId
router.get('/brainstorm/:meetingId', async (req, res) => {
    try {
        const board = await Brainstorm.findOne({ meetingId: req.params.meetingId }).lean();
        res.json({ items: board?.items || [] });
    } catch (err) {
        logger.error('[Collaboration] GET brainstorm error:', err);
        res.status(500).json({ message: 'Failed to load brainstorm board' });
    }
});

// POST /api/v2/collaboration/brainstorm/:meetingId — add a sticky note item
// Body: { workspaceId, text, position?, color? }
router.post('/brainstorm/:meetingId', async (req, res) => {
    try {
        const { workspaceId, text, position, color } = req.body;
        if (!text) return res.status(400).json({ message: 'text is required' });

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

        // Broadcast to meeting room
        req.io.to(`meeting:${req.params.meetingId}`).emit('brainstorm:update', {
            meetingId: req.params.meetingId,
            action: 'add',
            item: newItem,
        });

        res.status(201).json({ item: newItem });
    } catch (err) {
        logger.error('[Collaboration] POST brainstorm error:', err);
        res.status(500).json({ message: 'Failed to add brainstorm item' });
    }
});

// PATCH /api/v2/collaboration/brainstorm/:meetingId/:itemId — move or update item
// Body: { position?, text?, color? }
router.patch('/brainstorm/:meetingId/:itemId', async (req, res) => {
    try {
        const setPayload = {};
        const { position, text, color } = req.body;
        if (position) {
            setPayload['items.$.position.x'] = position.x;
            setPayload['items.$.position.y'] = position.y;
        }
        if (text !== undefined) setPayload['items.$.text'] = text;
        if (color !== undefined) setPayload['items.$.color'] = color;

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
        logger.error('[Collaboration] PATCH brainstorm error:', err);
        res.status(500).json({ message: 'Failed to update brainstorm item' });
    }
});

// DELETE /api/v2/collaboration/brainstorm/:meetingId/:itemId
router.delete('/brainstorm/:meetingId/:itemId', async (req, res) => {
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
