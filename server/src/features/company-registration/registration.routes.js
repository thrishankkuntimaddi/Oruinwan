const express = require("express");
const router = express.Router();
const registrationController = require("./registration.controller");
const requireAuth = require("../../shared/middleware/auth");
const User = require("../../../models/User");
const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const requireOwnCompany = require("../../shared/middleware/requireOwnCompany");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

// Current company admins (role read from the database), own company only.
const companyAdminGuard = [requireAuth, requireCompanyMember, requireOwnCompany("id"), requireCompanyRole("admin")];

// Platform (Oruinwan) admin only — same rule as requireSuperAdmin in admin.routes.js.
async function requireChttrixAdmin(req, res, next) {
    try {
        const user = await User.findById(req.user.sub).select("roles").lean();
        if (user && Array.isArray(user.roles) && user.roles.includes("chttrix_admin")) return next();
        return res.status(403).json({ message: "Access denied: Super Admin only" });
    } catch (err) {
        return res.status(500).json({ message: "Auth Error" });
    }
}

router.post("/register", registrationController.registerCompany);

router.post("/:id/verify", requireAuth, requireChttrixAdmin, registrationController.verifyCompany);

router.post("/:id/start-setup", ...companyAdminGuard, registrationController.startSetup);

router.put("/:id/setup", ...companyAdminGuard, registrationController.updateCompanySetup);

module.exports = router;
