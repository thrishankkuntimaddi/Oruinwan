const express = require('express');
const router = express.Router();
const identityController = require('./identity.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.post('/public-key', identityController.uploadPublicKey);

router.get('/users/:userId/public-key', identityController.getUserPublicKey);

router.post('/public-keys', identityController.batchGetPublicKeys);

router.get('/users/:userId/has-key', identityController.checkHasPublicKey);

router.delete('/public-key', identityController.deletePublicKey);

module.exports = router;
