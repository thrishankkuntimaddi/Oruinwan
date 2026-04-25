const express = require('express');
const router = express.Router();
const conversationKeysController = require('./conversationKeys.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.post('/:id/keys', conversationKeysController.storeConversationKeys);

router.get('/:id/keys', conversationKeysController.getConversationKey);

router.post('/:conversationId/keys/add-user', conversationKeysController.addUserKey);

router.get('/workspace/:workspaceId/keys', conversationKeysController.getUserWorkspaceKeys);

router.post('/:id/keys/add-user', conversationKeysController.addParticipant);

router.delete('/:id/keys/user/:userId', conversationKeysController.removeParticipant);

router.get('/:id/keys/exists', conversationKeysController.checkKeysExist);

router.post('/repair-access', conversationKeysController.repairUserAccess);

module.exports = router;
