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
  setPassword,
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
} = require("./auth.controller");

const requireAuth = require("../../shared/middleware/auth");

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
router.post("/me/set-password", requireAuth, setPassword); // For OAuth users
router.post("/oauth/set-password", requireAuth, setPassword); // Alias for backward compatibility
router.post("/oauth/skip-password", requireAuth, skipPassword); // Skip password setup for OAuth users

// EMAIL MANAGEMENT ROUTES
router.post("/me/emails", requireAuth, addEmail);
router.post("/me/emails/:id/verify", requireAuth, verifyEmailCode);
router.post("/me/emails/:id/resend", requireAuth, resendVerification);
router.put("/me/emails/:id/primary", requireAuth, setPrimaryEmail);
router.delete("/me/emails/:id", requireAuth, deleteEmail);

// USER PREFERENCES ROUTES
router.get("/me/preferences/privacy", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const user = await User.findById(req.user.sub).select("preferences");

    const privacy = user?.preferences?.privacy || {
      readReceipts: true,
      typingIndicators: true,
      allowDiscovery: true,
      dataSharing: false
    };

    res.json(privacy);
  } catch (_error) {
    console.error("GET PRIVACY PREFERENCES ERROR:", error);
    res.status(500).json({ message: "Failed to load privacy preferences" });
  }
});

router.put("/me/preferences/privacy", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const { readReceipts, typingIndicators, allowDiscovery, dataSharing } = req.body;

    await User.findByIdAndUpdate(req.user.sub, {
      "preferences.privacy": {
        readReceipts: readReceipts !== undefined ? readReceipts : true,
        typingIndicators: typingIndicators !== undefined ? typingIndicators : true,
        allowDiscovery: allowDiscovery !== undefined ? allowDiscovery : true,
        dataSharing: dataSharing !== undefined ? dataSharing : false
      }
    });

    res.json({ message: "Privacy preferences updated successfully" });
  } catch (_error) {
    console.error("UPDATE PRIVACY PREFERENCES ERROR:", error);
    res.status(500).json({ message: "Failed to update privacy preferences" });
  }
});

router.get("/me/preferences/region", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const user = await User.findById(req.user.sub).select("preferences");

    const region = user?.preferences?.region || {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY'
    };

    res.json(region);
  } catch (_error) {
    console.error("GET REGION PREFERENCES ERROR:", error);
    res.status(500).json({ message: "Failed to load region preferences" });
  }
});

router.put("/me/preferences/region", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const { language, timezone, dateFormat } = req.body;

    await User.findByIdAndUpdate(req.user.sub, {
      "preferences.region": {
        language: language || 'en',
        timezone: timezone || 'UTC',
        dateFormat: dateFormat || 'MM/DD/YYYY'
      }
    });

    res.json({ message: "Region preferences updated successfully" });
  } catch (_error) {
    console.error("UPDATE REGION PREFERENCES ERROR:", error);
    res.status(500).json({ message: "Failed to update region preferences" });
  }
});

router.get("/me/blocked-users", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const user = await User.findById(req.user.sub)
      .populate("blockedUsers", "_id username email profilePicture")
      .select("blockedUsers");

    res.json(user?.blockedUsers || []);
  } catch (_error) {
    console.error("GET BLOCKED USERS ERROR:", error);
    res.status(500).json({ message: "Failed to load blocked users" });
  }
});

router.delete("/me/blocked-users/:userId", requireAuth, async (req, res) => {
  try {
    const User = require("../../../models/User");
    const { userId } = req.params;

    await User.findByIdAndUpdate(req.user.sub, {
      $pull: { blockedUsers: userId }
    });

    res.json({ message: "User unblocked successfully" });
  } catch (_error) {
    console.error("UNBLOCK USER ERROR:", error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

// SESSION ROUTES
router.get("/sessions", requireAuth, getSessions);
router.delete("/sessions/others", requireAuth, revokeOtherSessions);
router.delete("/sessions/:id", requireAuth, revokeSession);

// USERS LIST (for DMs and channel invitations)
router.get("/users", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.sub;
    const User = require("../../../models/User");

    // Get all users except the current user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("_id username email profilePicture")
      .limit(100)
      .lean();

    res.json({ users });
  } catch (_err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GOOGLE LOGIN
router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  // alias

const passport = require("../../../config/passport");
const User = require("../../../models/User");
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
  (req, res) => {
    // Successful authentication
    const token = generateToken(req.user);
    // Also generate refresh token? For now just access token to bootstrap
    // Better to redirect to frontend which then calls /refresh or /me
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?access=${token}`);
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
        verified: true
      });
    }

    const token = generateToken(user);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?access=${token}`);
  } catch (_err) {
    console.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
});

module.exports = router;
