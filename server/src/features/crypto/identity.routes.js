const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
    initIdentityCryptoState,
    getIdentityCryptoState,
    unwrapUmekWithServerKEK,
    rotateUMEK,
    sealUmek,
    createUnlockRequest,
    getUnlockRequest,
    decideUnlockRequest
} = require('./identity.controller');

router.post('/identity/init', requireAuth, initIdentityCryptoState);

router.get('/identity', requireAuth, getIdentityCryptoState);

router.post('/identity/unwrap-umek', requireAuth, unwrapUmekWithServerKEK);

router.post('/identity/rotate-umek', requireAuth, rotateUMEK);

// Automatic unlock: seal a password-derived key on the server (see docs/api/auth-devices.md).
router.post('/identity/seal-umek', requireAuth, sealUmek);

router.post('/unlock-requests', requireAuth, createUnlockRequest);
router.get('/unlock-requests/:id', requireAuth, getUnlockRequest);
router.post('/unlock-requests/:id/decision', requireAuth, decideUnlockRequest);

module.exports = router;
