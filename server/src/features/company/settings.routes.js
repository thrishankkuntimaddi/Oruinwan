const express = require("express");
const router = express.Router();
const settingsController = require("./settings.controller");
const requireAuth = require("../../shared/middleware/auth");

router.put("/:id/settings/profile", requireAuth, settingsController.updateCompanyProfile);

router.put("/:id/settings/security", requireAuth, settingsController.updateSecuritySettings);

router.put("/:id/settings/domain", requireAuth, settingsController.updateDomainSettings);

module.exports = router;
