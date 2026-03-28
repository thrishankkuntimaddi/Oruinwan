// dmActions.routes.js
// Routes for DM contact option actions: clear, delete, block, mute
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./dmActions.controller');

router.use(requireAuth);

// Status: is this DM muted/blocked by current user?
router.get('/:dmId/status', ctrl.getDMStatus);

// Clear chat (per-user watermark)
router.post('/:dmId/clear', ctrl.clearDMChat);

// Delete chat (hide for current user)
router.delete('/:dmId', ctrl.deleteDMChat);

// Block / Unblock
router.post('/:dmId/block', ctrl.blockUser);
router.delete('/:dmId/block', ctrl.unblockUser);

// Mute / Unmute
router.post('/:dmId/mute', ctrl.muteDM);
router.delete('/:dmId/mute', ctrl.unmuteDM);

module.exports = router;
