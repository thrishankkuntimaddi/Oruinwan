/**
 * Conversation Keys Routes
 * API endpoints for conversation-level encryption key management
 * 
 * @module conversations/keys/routes
 */

const express = require('express');
const router = express.Router();
const conversationKeysController = require('./conversationKeys.controller');
const requireAuth = require('../../shared/middleware/auth');

// Apply authentication to all routes
router.use(requireAuth);

// ==================== CONVERSATION KEY MANAGEMENT ====================

// Store conversation keys (when conversation is created)
router.post('/:id/keys', conversationKeysController.storeConversationKeys);

// Get user's encrypted key for a conversation
router.get('/:id/keys', conversationKeysController.getConversationKey);

// Add encrypted key for a user (client-mediated distribution)
router.post('/:conversationId/keys/add-user', conversationKeysController.addUserKey);

// Get all conversation keys in workspace
router.get('/workspace/:workspaceId/keys', conversationKeysController.getUserWorkspaceKeys);

// Add participant to conversation (with encrypted key)
router.post('/:id/keys/add-user', conversationKeysController.addParticipant);

// Remove participant from conversation
router.delete('/:id/keys/user/:userId', conversationKeysController.removeParticipant);

// Check if conversation has encryption keys
router.get('/:id/keys/exists', conversationKeysController.checkKeysExist);

// ==================== PHASE 2: AUTOMATIC REPAIR ====================

// Trigger automatic repair for all user's channels
// Called by client after identity initialization
router.post('/repair-access', conversationKeysController.repairUserAccess);

module.exports = router;
