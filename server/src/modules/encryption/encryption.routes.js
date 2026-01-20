// server/src/modules/encryption/encryption.routes.js
/**
 * Encryption Routes
 * E2EE key management API endpoints
 * 
 * @module encryption/routes
 */

const express = require('express');
const router = express.Router();
const encryptionController = require('./encryption.controller');
const requireAuth = require('../../../middleware/auth');

// Apply authentication to all routes
router.use(requireAuth);

// ==================== WORKSPACE ENCRYPTION ====================

// Get user's workspace keys
router.get('/keys', encryptionController.getUserKeys);

// Enroll user in workspace encryption
router.post('/enroll', encryptionController.enrollUser);

// Revoke user access
router.delete('/revoke', encryptionController.revokeAccess);

// Check workspace access
router.get('/access/:workspaceId', encryptionController.checkAccess);

// ==================== PERSONAL E2EE (for DMs) ====================

// Store user's personal encryption keys (first-time setup)
router.post('/personal/keys', encryptionController.storePersonalKeys);

// Get user's own personal encryption keys
router.get('/personal/keys', encryptionController.getMyPersonalKeys);

// Get another user's public key (for DM encryption)
router.get('/personal/users/:userId/public-key', encryptionController.getUserPublicKey);

module.exports = router;
