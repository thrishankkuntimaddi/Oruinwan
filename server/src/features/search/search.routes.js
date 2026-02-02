// server/routes/search.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const searchCtrl = require("./search.controller");

// Universal search endpoint
router.get("/universal", requireAuth, searchCtrl.universalSearch);
router.get("/contacts", requireAuth, searchCtrl.searchContactsHandler);

module.exports = router;
