const express = require("express");
const router = express.Router();
const companyController = require("./company.controller");
const otpController = require("../../shared/controllers/otp.controller");
const requireAuth = require("../../shared/middleware/auth");

const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

router.post("/check-name", companyController.checkCompanyName);

router.post("/check-domain", companyController.checkCompanyDomain);

router.post("/check-email", companyController.checkEmail);

router.post("/check-phone", companyController.checkPhone);

router.post("/otp/send", otpController.sendOtp);

router.post("/otp/verify", otpController.verifyOtp);

router.get(
    "/:id",
    requireAuth,
    requireCompanyMember,
    companyController.getCompany
);

router.put(
    "/:id",
    requireAuth,
    requireCompanyMember,
    requireCompanyRole("admin"),
    companyController.updateCompany
);

router.get(
    "/:id/members",
    requireAuth,
    requireCompanyMember,
    companyController.getCompanyMembers
);

router.put(
    "/:id/members/:userId/role",
    requireAuth,
    requireCompanyMember,
    requireCompanyRole("admin"),
    companyController.updateMemberRole
);

router.post(
    "/:id/start-setup",
    requireAuth,
    requireCompanyMember,
    requireCompanyRole("admin"),
    companyController.startSetup
);

router.put(
    "/:id/setup",
    requireAuth,
    requireCompanyMember,
    requireCompanyRole("admin"),
    companyController.handleSetup
);

router.get(
    "/:id/setup/template",
    requireAuth,
    requireCompanyMember,
    requireCompanyRole("admin"),
    companyController.downloadTemplate
);

module.exports = router;
