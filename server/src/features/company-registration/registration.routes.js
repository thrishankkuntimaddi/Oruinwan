const express = require("express");
const router = express.Router();
const registrationController = require("./registration.controller");
const requireAuth = require("../../shared/middleware/auth");

router.post("/register", registrationController.registerCompany);

router.post("/:id/verify", registrationController.verifyCompany);

router.post("/:id/start-setup", requireAuth, registrationController.startSetup);

router.put("/:id/setup", requireAuth, registrationController.updateCompanySetup);

module.exports = router;
