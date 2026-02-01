// src/features/domain-verification/domain.routes.js

const express = require("express");
const router = express.Router();
const domainController = require("./domain.controller");
const requireAuth = require("../../../middleware/auth");

/**
 * @route   POST /api/companies/:id/domain/generate
 * @desc    Generate domain verification token
 * @access  Private (company admin)
 */
router.post("/:id/domain/generate", requireAuth, domainController.generateDomainVerification);

/**
 * @route   POST /api/companies/:id/domain/verify
 * @desc    Verify domain via DNS TXT record
 * @access  Private (company admin)
 */
router.post("/:id/domain/verify", requireAuth, domainController.verifyDomain);

/**
 * @route   PUT /api/companies/:id/domain/auto-join
 * @desc    Enable/disable domain auto-join
 * @access  Private (company owner)
 */
router.put("/:id/domain/auto-join", requireAuth, domainController.setAutoJoinPolicy);

module.exports = router;
