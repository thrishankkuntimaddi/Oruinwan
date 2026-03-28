/**
 * Identity Routes
 * E2EE identity key management API endpoints
 * 
 * @module identity/routes
 */

const express = require('express');
const router = express.Router();
const identityController = require('./identity.controller');
const requireAuth = require('../../shared/middleware/auth');

// Apply authentication to all routes
router.use(requireAuth);

// ==================== PUBLIC KEY MANAGEMENT ====================

// Upload user's public key
router.post('/public-key', identityController.uploadPublicKey);

// Get a user's public key
router.get('/users/:userId/public-key', identityController.getUserPublicKey);

// Batch fetch public keys
router.post('/public-keys', identityController.batchGetPublicKeys);

// Check if user has public key
router.get('/users/:userId/has-key', identityController.checkHasPublicKey);

// Delete own public key
router.delete('/public-key', identityController.deletePublicKey);

module.exports = router;
