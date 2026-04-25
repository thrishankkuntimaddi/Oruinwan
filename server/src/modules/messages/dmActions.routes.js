const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./dmActions.controller');

router.use(requireAuth);

router.get('/:dmId/status', ctrl.getDMStatus);

router.post('/:dmId/clear', ctrl.clearDMChat);

router.delete('/:dmId', ctrl.deleteDMChat);

router.post('/:dmId/block', ctrl.blockUser);
router.delete('/:dmId/block', ctrl.unblockUser);

router.post('/:dmId/mute', ctrl.muteDM);
router.delete('/:dmId/mute', ctrl.unmuteDM);

module.exports = router;
