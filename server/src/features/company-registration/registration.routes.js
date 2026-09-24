const express = require("express");
const router = express.Router();
const registrationController = require("./registration.controller");
const requireAuth = require("../../shared/middleware/auth");
const User = require("../../../models/User");

// Platform (Chttrix) admin only — same rule as requireSuperAdmin in admin.routes.js.
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

router.post("/:id/start-setup", requireAuth, registrationController.startSetup);

router.put("/:id/setup", requireAuth, registrationController.updateCompanySetup);

module.exports = router;
