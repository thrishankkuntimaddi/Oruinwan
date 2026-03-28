// server/src/features/devices/devices.routes.js

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
    getDevices,
    revokeDevice,
    revokeOtherDevices
} = require('./devices.controller');

// Get all device sessions for current user
router.get('/', requireAuth, getDevices);

// Revoke a specific device session
router.post('/revoke', requireAuth, revokeDevice);

// Revoke all other device sessions
router.post('/revoke-others', requireAuth, revokeOtherDevices);

module.exports = router;
