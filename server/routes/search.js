// server/routes/search.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const searchCtrl = require("../controllers/searchController");

// Universal search endpoint
router.get("/universal", requireAuth, searchCtrl.universalSearch);
router.get("/contacts", requireAuth, searchCtrl.searchContactsHandler);

module.exports = router;
