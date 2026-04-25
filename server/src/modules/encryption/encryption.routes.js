const express = require('express');
const router = express.Router();
const encryptionController = require('./encryption.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/keys', encryptionController.getUserKeys);

router.post('/enroll', encryptionController.enrollUser);

router.delete('/revoke', encryptionController.revokeAccess);

router.get('/access/:workspaceId', encryptionController.checkAccess);

router.post('/personal/keys', encryptionController.storePersonalKeys);

router.get('/personal/keys', encryptionController.getMyPersonalKeys);

router.get('/personal/users/:userId/public-key', encryptionController.getUserPublicKey);

module.exports = router;
