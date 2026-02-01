// src/features/company/settings.routes.js

const express = require("express");
const router = express.Router();
const settingsController = require("./settings.controller");
const requireAuth = require("../../../middleware/auth");

/**
 * @route   PUT /api/companies/:id/settings/profile
 * @desc    Update company profile settings
 * @access  Private (company admin)
 */
router.put("/:id/settings/profile", requireAuth, settingsController.updateCompanyProfile);

/**
 * @route   PUT /api/companies/:id/settings/security
 * @desc    Update security settings
 * @access  Private (company admin)
 */
router.put("/:id/settings/security", requireAuth, settingsController.updateSecuritySettings);

/**
 * @route   PUT /api/companies/:id/settings/domain
 * @desc    Update domain & SSO settings
 * @access  Private (company admin)
 */
router.put("/:id/settings/domain", requireAuth, settingsController.updateDomainSettings);

module.exports = router;
