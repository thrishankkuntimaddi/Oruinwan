const express = require("express");
const router = express.Router();
const domainController = require("./domain.controller");
const requireAuth = require("../../shared/middleware/auth");

router.post("/:id/domain/generate", requireAuth, domainController.generateDomainVerification);

router.post("/:id/domain/verify", requireAuth, domainController.verifyDomain);

router.put("/:id/domain/auto-join", requireAuth, domainController.setAutoJoinPolicy);

module.exports = router;
