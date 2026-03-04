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
  deleteEmail,
  deactivateAccount,
  verifyReactivationOTP
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

// ACCOUNT MANAGEMENT ROUTES
router.post("/me/deactivate", requireAuth, deactivateAccount);
router.post("/reactivate/verify-otp", verifyReactivationOTP);

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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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

    // SECURITY FIX (BUG-8): Scope users list to the requester's company.
    // Previously returned all platform users \u2014 a user from Company A could enumerate
    // all Company B users. Now: company users see only their company, personal users
    // see only other personal (companyless) users.
    const currentUser = await User.findById(currentUserId).select('companyId').lean();

    const query = currentUser?.companyId
      ? { _id: { $ne: currentUserId }, companyId: currentUser.companyId }
      // BUGFIX: $exists: false alone misses documents where companyId is explicitly null.
      // User schema defaults companyId to null — so we must match BOTH null and missing field.
      : { _id: { $ne: currentUserId }, $or: [{ companyId: null }, { companyId: { $exists: false } }] };

    const users = await User.find(query)
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
    // SECURITY FIX: Use URL fragment (#) instead of query string (?)
    // Fragments are never sent to servers, never appear in access logs,
    // and never appear in Referer headers sent to third-party resources.
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success#access=${token}`);
  }
);

// LinkedIn OAuth - Manual OpenID Connect Implementation
// Using /v2/userinfo endpoint (passport-linkedin-oauth2 uses deprecated /v2/me)
router.get("/linkedin", (req, res) => {
  // SECURITY FIX (BUG-11): Use cryptographically secure random bytes for the OAuth state.
  // Math.random() is predictable and not safe for CSRF protection.
  const { randomBytes } = require('crypto');
  const state = randomBytes(16).toString('hex');

  // Store state in a short-lived HttpOnly cookie so we can validate it on callback.
  // SameSite=Lax prevents cross-site cookie sending while allowing the OAuth redirect.
  res.cookie('linkedin_oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 5 * 60 * 1000,           // 5 minutes — OAuth flows complete within this window
    secure: process.env.NODE_ENV === 'production'
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state,
  });

  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
});

router.get("/linkedin/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('LinkedIn OAuth error:', error, error_description);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
    }

    // SECURITY FIX (BUG-11): Validate the state parameter against the cookie value.
    // Without this check, any request to the callback URL processes an OAuth code,
    // which enables CSRF — an attacker can link a victim's session to the attacker's account.
    const storedState = req.cookies?.linkedin_oauth_state;
    if (!state || !storedState || state !== storedState) {
      console.error('LinkedIn OAuth: state mismatch — potential CSRF attack');
      res.clearCookie('linkedin_oauth_state');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_state_mismatch`);
    }
    // Clear the state cookie — single use only
    res.clearCookie('linkedin_oauth_state');

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
    // SECURITY FIX: Use URL fragment (#) instead of query string (?)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success#access=${token}`);
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
});

module.exports = router;
