const express = require("express");
const router = express.Router();
const employeeController = require("./employee.controller");
const requireAuth = require("../../shared/middleware/auth");

const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

router.post("/:id/invite", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.inviteEmployee);

router.post("/:id/invite/bulk", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.bulkInviteEmployees);

router.post("/:id/employees/create", requireAuth, requireCompanyMember, requireCompanyRole('admin'), employeeController.directCreateEmployee);

router.post("/accept-invite", employeeController.acceptInvite);

router.post("/check-eligibility", employeeController.checkEligibility);

module.exports = router;
