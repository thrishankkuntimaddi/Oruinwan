// server/routes/auth.js

const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

// AUTH ROUTES
router.post("/signup", authController.signup);
router.get("/verify-email", authController.verifyEmail);
router.post("/login", authController.login);
router.get("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", authController.logoutAll);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// PROFILE ROUTES
router.get("/me", authMiddleware, authController.getMe);
router.put("/me", authMiddleware, authController.updateMe);
router.put("/me/password", authMiddleware, authController.updatePassword);

module.exports = router;
