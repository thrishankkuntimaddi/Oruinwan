const express = require("express");
const router = express.Router();
const settingsController = require("./settings.controller");
const requireAuth = require("../../shared/middleware/auth");
const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

// Caller may only modify the company they belong to (requireCompanyMember sets req.companyId).
function requireOwnCompany(req, res, next) {
    if (String(req.params.id) !== String(req.companyId)) {
        return res.status(403).json({ success: false, error: "Access denied", code: "COMPANY_MISMATCH" });
    }
    next();
}

const guard = [requireAuth, requireCompanyMember, requireOwnCompany, requireCompanyRole("admin")];

router.put("/:id/settings/profile", ...guard, settingsController.updateCompanyProfile);

router.put("/:id/settings/security", ...guard, settingsController.updateSecuritySettings);

router.put("/:id/settings/domain", ...guard, settingsController.updateDomainSettings);

module.exports = router;
