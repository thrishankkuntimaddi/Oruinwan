// server/src/features/crypto/identity.routes.js

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const {
    initIdentityCryptoState,
    getIdentityCryptoState,
    unwrapUmekWithServerKEK,
    rotateUMEK
} = require('./identity.controller');


// Initialize/update identity crypto state
router.post('/identity/init', requireAuth, initIdentityCryptoState);

// Get identity crypto state
router.get('/identity', requireAuth, getIdentityCryptoState);

// Unwrap UMEK with server KEK (for OAuth skip-password users)
router.post('/identity/unwrap-umek', requireAuth, unwrapUmekWithServerKEK);

// Rotate UMEK protection (Phase 2: password change support)
router.post('/identity/rotate-umek', requireAuth, rotateUMEK);

module.exports = router;

