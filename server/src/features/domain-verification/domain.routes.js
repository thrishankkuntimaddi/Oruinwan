const express = require("express");
const router = express.Router();
const domainController = require("./domain.controller");
const requireAuth = require("../../shared/middleware/auth");
const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const requireOwnCompany = require("../../shared/middleware/requireOwnCompany");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

// Current company admins (role read from the database), own company only.
const companyAdminGuard = [requireAuth, requireCompanyMember, requireOwnCompany("id"), requireCompanyRole("admin")];

router.post("/:id/domain/generate", ...companyAdminGuard, domainController.generateDomainVerification);

router.post("/:id/domain/verify", ...companyAdminGuard, domainController.verifyDomain);

router.put("/:id/domain/auto-join", ...companyAdminGuard, domainController.setAutoJoinPolicy);

module.exports = router;
