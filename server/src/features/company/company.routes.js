const express = require("express");
const router = express.Router();
const companyController = require("./company.controller");
const otpController = require("../../shared/controllers/otp.controller");
const requireAuth = require("../../shared/middleware/auth");

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * @route   POST /api/companies/check-name
 * @desc    Check if company name already exists
 * @access  Public
 */
router.post("/check-name", companyController.checkCompanyName);

/**
 * @route   POST /api/companies/check-domain
 * @desc    Check if company domain already exists
 * @access  Public
 */
router.post("/check-domain", companyController.checkCompanyDomain);

/**
 * @route   POST /api/companies/check-email
 * @desc    Check if email already exists
 * @access  Public
 */
router.post("/check-email", companyController.checkEmail);

/**
 * @route   POST /api/companies/check-phone
 * @desc    Check if phone number already exists
 * @access  Public
 */
router.post("/check-phone", companyController.checkPhone);

/**
 * @route   POST /api/companies/otp/send
 * @desc    Send OTP for company registration verification
 * @access  Public
 */
router.post("/otp/send", otpController.sendOtp);

/**
 * @route   POST /api/companies/otp/verify
 * @desc    Verify OTP for company registration
 * @access  Public
 */
router.post("/otp/verify", otpController.verifyOtp);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * @route   GET /api/companies/:id
 * @desc    Get company details
 * @access  Private (company members)
 */
router.get("/:id", requireAuth, companyController.getCompany);

/**
 * @route   PUT /api/companies/:id
 * @desc    Update company settings
 * @access  Private (company admin)
 */
router.put("/:id", requireAuth, companyController.updateCompany);

/**
 * @route   GET /api/companies/:id/members
 * @desc    Get company members
 * @access  Private (company members)
 */
router.get("/:id/members", requireAuth, companyController.getCompanyMembers);

/**
 * @route   PUT /api/companies/:id/members/:userId/role
 * @desc    Update member role
 * @access  Private (company admin)
 */
router.put("/:id/members/:userId/role", requireAuth, companyController.updateMemberRole);

// ============================================================================
// SETUP WIZARD ROUTES
// ============================================================================

/**
 * @route   POST /api/companies/:id/start-setup
 * @desc    Accept terms and start setup wizard
 * @access  Private (company admin)
 */
router.post("/:id/start-setup", requireAuth, companyController.startSetup);

/**
 * @route   PUT /api/companies/:id/setup
 * @desc    Handle each setup step (multipart: logo or excel file)
 * @access  Private (company admin)
 */
router.put("/:id/setup", requireAuth, companyController.handleSetup);

/**
 * @route   GET /api/companies/:id/setup/template
 * @desc    Download sample Excel employee template
 * @access  Private (company admin)
 */
router.get("/:id/setup/template", requireAuth, companyController.downloadTemplate);

module.exports = router;
