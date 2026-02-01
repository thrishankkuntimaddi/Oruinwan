// server/routes/favorites.js
const express = require("express");
const router = express.Router();
const favoriteController = require("../controllers/favoriteController");
const auth = require("../middleware/auth");

// Get favorites for workspace
router.get("/:workspaceId", auth, favoriteController.getFavorites);

// Add to favorites
router.post("/", auth, favoriteController.addFavorite);

// Remove from favorites
router.delete("/:id", auth, favoriteController.removeFavorite);

module.exports = router;
