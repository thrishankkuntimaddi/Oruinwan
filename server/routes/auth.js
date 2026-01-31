// server/routes/auth.js
// CANONICAL: src/features/auth/auth.controller.js
// Phase 2D-1.1: OAuth logic extracted ✅ (145 LOC moved to controller)

const express = require("express");
const router = express.Router();
const axios = require("axios");

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
  setOAuthPassword,
  skipPassword,
  googleLogin,
  googleAuth,
  getSessions,
  revokeSession,
  revokeOtherSessions,
  addEmail,
  verifyEmailCode,
  resendVerification,
  setPrimaryEmail,
  deleteEmail,
  getUsersList,
  githubCallback,
  linkedinInitiate,
  linkedinCallback
} = require("../src/features/auth/auth.controller");

const requireAuth = require("../middleware/auth");

// AUTH ROUTES
router.post("/signup", signup);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/refresh", refresh);  // Changed from GET to POST - mutations should use POST
router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// PROFILE ROUTES
router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/password", requireAuth, updatePassword);

// OAUTH PASSWORD SETUP (first-time only for OAuth users)
router.post("/oauth/set-password", requireAuth, setOAuthPassword);
router.post("/oauth/skip-password", requireAuth, skipPassword);

// EMAIL MANAGEMENT ROUTES
router.post("/me/emails", requireAuth, addEmail);
router.post("/me/emails/:id/verify", requireAuth, verifyEmailCode);
router.post("/me/emails/:id/resend", requireAuth, resendVerification);
router.put("/me/emails/:id/primary", requireAuth, setPrimaryEmail);
router.delete("/me/emails/:id", requireAuth, deleteEmail);

// SESSION ROUTES
router.get("/sessions", requireAuth, getSessions);
router.delete("/sessions/others", requireAuth, revokeOtherSessions);
router.delete("/sessions/:id", requireAuth, revokeSession);

// USERS LIST (for DMs and channel invitations)
router.get("/users", requireAuth, getUsersList);

// GOOGLE LOGIN
router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  // alias

const passport = require("../config/passport");

// GITHUB ROUTES
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/login?error=github_failed" }),
  githubCallback
);

// LinkedIn OAuth - Manual OpenID Connect Implementation
// Using /v2/userinfo endpoint (passport-linkedin-oauth2 uses deprecated /v2/me)
router.get("/linkedin", linkedinInitiate);

router.get("/linkedin/callback", linkedinCallback);

module.exports = router;
