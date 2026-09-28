'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Whiteboard = require('./whiteboard.model');
const Brainstorm = require('./brainstorm.model');
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
