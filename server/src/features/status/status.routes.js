const express = require('express');
const router = express.Router();
const statusController = require('./status.controller');

router.get('/health', statusController.getSystemHealth);

module.exports = router;
