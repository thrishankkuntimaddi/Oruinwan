// server/routes/auth.js

const express = require("express");
const router = express.Router();

const {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");

// AUTH ROUTES
router.post("/signup", signup);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.get("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
