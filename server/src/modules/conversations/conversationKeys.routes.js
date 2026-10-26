const express = require('express');
const router = express.Router();
const conversationKeysController = require('./conversationKeys.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.post('/:id/keys', conversationKeysController.storeConversationKeys);

router.get('/:id/keys', conversationKeysController.getConversationKey);

router.post('/:conversationId/keys/add-user', conversationKeysController.addUserKey);

router.get('/workspace/:workspaceId/keys', conversationKeysController.getUserWorkspaceKeys);

// (A second POST /:id/keys/add-user used to be registered here; the route above always answered
// first, and the second had no access check, so it is gone.)

// Only your own copy (a device that set encryption up again). People leaving or being removed lose
// theirs on the server (conversationRooms.evictFrom…, groupDM.service).
router.delete('/:id/keys/user/:userId', conversationKeysController.removeParticipant);

router.get('/:id/keys/exists', conversationKeysController.checkKeysExist);

router.post('/repair-access', conversationKeysController.repairUserAccess);

router.get('/escrow-needed', conversationKeysController.escrowNeeded);

router.post('/:id/keys/escrow', conversationKeysController.escrowKey);

router.post('/:id/keys/rewrap', conversationKeysController.rewrapKey);

module.exports = router;
