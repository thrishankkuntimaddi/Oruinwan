const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const auth = require("../middleware/auth");

// Create Company
// TEMPORARY: Public route to create a company BEFORE onboarding
router.post("/create-initial", companyController.createInitialCompany);
router.post("/", auth, companyController.createCompany);

// Invite to Company
router.post("/:companyId/invite", auth, companyController.inviteToCompany);

// Check domain (public) - used by SignupForm to hint company
router.get("/check-domain", companyController.checkDomain);

// Domain verification routes
router.post("/:id/domain/generate", auth, companyController.generateDomainToken);
router.get("/:id/domain/check", auth, companyController.checkDomainVerification);
router.post("/:id/domain/clear", auth, companyController.clearDomainVerification);

// Accept invite (no auth required)
router.post("/invite/accept", companyController.acceptInvite);

module.exports = router;
