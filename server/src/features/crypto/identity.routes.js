const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
    initIdentityCryptoState,
    getIdentityCryptoState,
    unwrapUmekWithServerKEK,
    rotateUMEK
} = require('./identity.controller');

router.post('/identity/init', requireAuth, initIdentityCryptoState);

router.get('/identity', requireAuth, getIdentityCryptoState);

router.post('/identity/unwrap-umek', requireAuth, unwrapUmekWithServerKEK);

router.post('/identity/rotate-umek', requireAuth, rotateUMEK);

module.exports = router;
