// src/features/employees/employee.routes.js

const express = require("express");
const router = express.Router();
const employeeController = require("./employee.controller");
const requireAuth = require("../../shared/middleware/auth");

/**
 * @route   POST /api/companies/:id/invite
 * @desc    Invite single employee
 * @access  Private (company admin)
 */
router.post("/:id/invite", requireAuth, employeeController.inviteEmployee);

/**
 * @route   POST /api/companies/:id/invite/bulk
 * @desc    Bulk invite employees
 * @access  Private (company admin)
 */
router.post("/:id/invite/bulk", requireAuth, employeeController.bulkInviteEmployees);

/**
 * @route   POST /api/companies/:id/employees/create
 * @desc    Admin directly creates employee (Method 4 - No email invite)
 * @access  Private (company admin)
 */
router.post("/:id/employees/create", requireAuth, employeeController.directCreateEmployee);

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
