// server/routes/statusRoutes.js

const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');

// GET /api/status/health - Get system health status
router.get('/health', statusController.getSystemHealth);

module.exports = router;
