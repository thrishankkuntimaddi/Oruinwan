const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const {
    getDevices,
    renameDevice,
    revokeDevice,
    deleteDevice,
    revokeOtherDevices
} = require('./devices.controller');

router.get('/', requireAuth, getDevices);

router.post('/revoke', requireAuth, revokeDevice);

router.post('/revoke-others', requireAuth, revokeOtherDevices);

router.patch('/:deviceId', requireAuth, renameDevice);

router.delete('/:deviceId', requireAuth, deleteDevice);

module.exports = router;
