// server/routes/companies.js

const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const requireAuth = require("../middleware/auth");

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * @route   POST /api/companies/register
 * @desc    Register a new company with admin user
 * @body    companyName, adminName, adminEmail, domain, documents
 * @access  Public
 */
router.post("/register", companyController.registerCompany);

/**
 * @route   POST /api/companies/accept-invite
 * @desc    Accept company invitation
 * @body    token, username, password
 * @access  Public
 */
router.post("/accept-invite", companyController.acceptInvite);

/**
 * @route   POST /api/companies/check-eligibility
 * @desc    Check if email can auto-join a company
 * @body    email
 * @access  Public
 */
router.post("/check-eligibility", companyController.checkEligibility);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// All routes below require authentication


/**
 * @route   GET /api/companies/:id
 * @desc    Get company details
 * @access  Private (company members)
 */
router.get("/:id", requireAuth, companyController.getCompany);

/**
 * @route   GET /api/companies/:id/members
 * @desc    Get company members
 * @access  Private (company members)
 */
router.get("/:id/members", requireAuth, companyController.getCompanyMembers);

/**
 * @route   PUT /api/companies/:id/members/:userId/role
 * @desc    Update member role
 * @body    role
 * @access  Private (company admin)
 */
router.put("/:id/members/:userId/role", requireAuth, companyController.updateMemberRole);

// ============================================================================
// DOMAIN VERIFICATION ROUTES
// ============================================================================

/**
 * @route   POST /api/companies/:id/domain/generate
 * @desc    Generate domain verification token
 * @access  Private (company admin)
 */
router.post("/:id/domain/generate", requireAuth, companyController.generateDomainVerification);

/**
 * @route   POST /api/companies/:id/domain/verify
 * @desc    Verify domain via DNS TXT record
 * @access  Private (company admin)
 */
router.post("/:id/domain/verify", requireAuth, companyController.verifyDomain);

/**
 * @route   PUT /api/companies/:id/domain/auto-join
 * @desc    Enable/disable domain auto-join
 * @body    autoJoinByDomain (boolean)
 * @access  Private (company owner)
 */
router.put("/:id/domain/auto-join", requireAuth, companyController.setAutoJoinPolicy);

// ============================================================================
// EMPLOYEE INVITATION ROUTES
// ============================================================================

/**
 * @route   POST /api/companies/:id/invite
 * @desc    Invite single employee
 * @body    email, role, workspaceId
 * @access  Private (company admin)
 */
router.post("/:id/invite", requireAuth, companyController.inviteEmployee);

/**
 * @route   POST /api/companies/:id/invite/bulk
 * @desc    Bulk invite employees
 * @body    employees (array of { name, email, role })
 * @access  Private (company admin)
 */
router.post("/:id/invite/bulk", requireAuth, companyController.bulkInviteEmployees);

module.exports = router;
