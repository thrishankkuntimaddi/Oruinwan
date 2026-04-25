const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
    getDevices,
    revokeDevice,
    revokeOtherDevices
} = require('./devices.controller');

router.get('/', requireAuth, getDevices);

router.post('/revoke', requireAuth, revokeDevice);

router.post('/revoke-others', requireAuth, revokeOtherDevices);

module.exports = router;
