// src/features/employees/employee.routes.js

const express = require("express");
const router = express.Router();
const employeeController = require("./employee.controller");
const requireAuth = require("../../shared/middleware/auth");
// S-03: Added requireCompanyMember + requireCompanyRole to gate admin-only routes.
// Previously these three routes had only requireAuth — any authenticated user could call them.
const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

/**
 * @route   POST /api/companies/:id/invite
 * @desc    Invite single employee
 * @access  Private (company admin) — S-03: requireCompanyMember + requireCompanyRole added
 */
router.post("/:id/invite", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.inviteEmployee);

/**
 * @route   POST /api/companies/:id/invite/bulk
 * @desc    Bulk invite employees
 * @access  Private (company admin) — S-03: requireCompanyMember + requireCompanyRole added
 */
router.post("/:id/invite/bulk", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.bulkInviteEmployees);

/**
 * @route   POST /api/companies/:id/employees/create
 * @desc    Admin directly creates employee (Method 4 - No email invite)
 * @access  Private (company admin) — S-03: requireCompanyMember + requireCompanyRole added
 */
router.post("/:id/employees/create", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.directCreateEmployee);

/**
 * @route   POST /api/companies/accept-invite
 * @desc    Accept company invitation
 * @access  Public
 */
router.post("/accept-invite", employeeController.acceptInvite);

/**
 * @route   POST /api/companies/check-eligibility
 * @desc    Check if email can auto-join a company
 * @access  Public
 */
router.post("/check-eligibility", employeeController.checkEligibility);

module.exports = router;
