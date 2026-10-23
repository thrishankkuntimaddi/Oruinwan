const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./dmActions.controller');

router.use(requireAuth);

// Group DMs (3+ people).
router.post('/group', ctrl.createGroupDM);
router.get('/:dmId', ctrl.getDMDetails);
router.patch('/:dmId', ctrl.renameGroupDM);
router.post('/:dmId/members', ctrl.addGroupDMMembers);
router.delete('/:dmId/members/:userId', ctrl.removeGroupDMMember);

router.get('/:dmId/status', ctrl.getDMStatus);

router.post('/:dmId/clear', ctrl.clearDMChat);

router.delete('/:dmId', ctrl.deleteDMChat);

router.post('/:dmId/block', ctrl.blockUser);
router.delete('/:dmId/block', ctrl.unblockUser);

router.post('/:dmId/mute', ctrl.muteDM);
router.delete('/:dmId/mute', ctrl.unmuteDM);

module.exports = router;
