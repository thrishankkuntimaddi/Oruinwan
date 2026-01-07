// server/routes/onboardRoutes.js
const express = require('express');
const router = express.Router();
const { createEmployee } = require('../controllers/onboardEmployeeController');
const requireAuth = require('../middleware/auth');

/**
 * @route   POST /api/admin/onboard-employee
 * @desc    Admin creates employee account directly
 * @access  Private (Company Admin only)
 */
router.post('/onboard-employee', requireAuth, createEmployee);

module.exports = router;
