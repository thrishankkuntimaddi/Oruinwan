// server/routes/auth.js

const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  verifyEmail,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  updatePassword,
  googleLogin,
  googleAuth,
} = require("../controllers/authController");

const requireAuth = require("../middleware/auth");

// AUTH ROUTES
router.post("/signup", signup);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.get("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// PROFILE ROUTES
router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/password", requireAuth, updatePassword);

// GOOGLE LOGIN
router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  // alias

module.exports = router;
