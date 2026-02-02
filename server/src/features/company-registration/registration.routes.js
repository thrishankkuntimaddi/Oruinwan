// src/features/company-registration/registration.routes.js

const express = require("express");
const router = express.Router();
const registrationController = require("./registration.controller");
const requireAuth = require("../../shared/middleware/auth");

/**
 * @route   POST /api/companies/register
 * @desc    Register a new company with admin user
 * @access  Public
 */
router.post("/register", registrationController.registerCompany);

/**
 * @route   POST /api/companies/:id/verify
 * @desc    Internal: Verify company and provision resources
 * @access  Internal Admin
 */
router.post("/:id/verify", registrationController.verifyCompany);

/**
 * @route   POST /api/companies/:id/start-setup
 * @desc    Start setup process (Confirm -> Wizard)
 * @access  Private (Admin)
 */
router.post("/:id/start-setup", requireAuth, registrationController.startSetup);

/**
 * @route   PUT /api/companies/:id/setup
 * @desc    Update company setup progress
 * @access  Private (Admin)
 */
router.put("/:id/setup", requireAuth, registrationController.updateCompanySetup);

module.exports = router;
