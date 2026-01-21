// server/routes/auth.js

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
  deleteEmail
} = require("../controllers/authController");

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
router.get("/users", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.sub;
    const User = require("../models/User");

    // Get all users except the current user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("_id username email profilePicture")
      .limit(100)
      .lean();

    res.json({ users });
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GOOGLE LOGIN
router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  // alias

const passport = require("../config/passport");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Helper to generate token (if not exported from controller)
const generateToken = (user) => {
  return jwt.sign(
    { sub: user._id, username: user.username, role: user.roles?.[0] || 'user' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' } // Short lived access token, frontend should exchange/use it
  );
};

// GITHUB ROUTES
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/login?error=github_failed" }),
  async (req, res) => {
    // Successful authentication
    const token = generateToken(req.user);

    // Check if password setup required (skip if already set OR explicitly skipped)
    const requiresPasswordSetup = req.user.authProvider !== 'local' && !req.user.passwordSetAt && !req.user.passwordSkipped;
    const params = new URLSearchParams({
      access: token,
      requiresPasswordSetup: requiresPasswordSetup.toString()
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?${params.toString()}`);
  }
);

// LinkedIn OAuth - Manual OpenID Connect Implementation
// Using /v2/userinfo endpoint (passport-linkedin-oauth2 uses deprecated /v2/me)
router.get("/linkedin", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state: Math.random().toString(36).substring(7), // Simple random state for CSRF protection
  });

  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
});

router.get("/linkedin/callback", async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error('LinkedIn OAuth error:', error, error_description);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
    }

    // Exchange code for access token
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch user info using OpenID Connect userinfo endpoint
    const userInfoRes = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const linkedinUser = userInfoRes.data;
    console.log('LinkedIn user profile:', linkedinUser);

    // Find or create user
    let user = await User.findOne({ linkedinId: linkedinUser.sub });

    if (!user && linkedinUser.email) {
      // Try to find by email to link accounts
      user = await User.findOne({ email: linkedinUser.email });
      if (user) {
        user.linkedinId = linkedinUser.sub;
        if (linkedinUser.picture) user.profilePicture = linkedinUser.picture;
        await user.save();
      }
    }

    if (!user) {
      // Create new user
      user = await User.create({
        linkedinId: linkedinUser.sub,
        username: linkedinUser.name || linkedinUser.given_name || `linkedin_${linkedinUser.sub}`,
        email: linkedinUser.email,
        profilePicture: linkedinUser.picture,
        authProvider: "linkedin",
        passwordHash: "oauth-linkedin-" + linkedinUser.sub,
        verified: true,
        passwordSetAt: null,  // Password not set yet
        passwordLoginEnabled: false  // Disable password login until set
      });
    }

    const token = generateToken(user);

    // Check if password setup required (skip if already set OR explicitly skipped)
    const requiresPasswordSetup = user.authProvider !== 'local' && !user.passwordSetAt && !user.passwordSkipped;
    const params = new URLSearchParams({
      access: token,
      requiresPasswordSetup: requiresPasswordSetup.toString()
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?${params.toString()}`);
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
});

module.exports = router;
