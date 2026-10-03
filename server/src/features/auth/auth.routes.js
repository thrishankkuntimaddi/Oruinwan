const logger = require('../../../utils/logger');
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
  verifyReactivationOTP,
  setupTempPassword,
} = require("./auth.controller");

const requireAuth = require("../../shared/middleware/auth");
const { discoverablePeople } = require("./privacy.service");
const identity = require("../../identity");

router.post("/signup", signup);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/refresh", refresh);  
router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/password", requireAuth, updatePassword);
router.post("/me/set-password", requireAuth, setPassword); 
router.post("/oauth/set-password", requireAuth, setPassword); 
router.post("/oauth/skip-password", requireAuth, skipPassword); 
router.post("/setup-temp-password", requireAuth, setupTempPassword); 

const multer = require('multer');
const { uploadObject, deleteObject } = require('../../modules/uploads/upload.service');

const profilePicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    // SVG is intentionally excluded: it can carry script and is served from a public bucket.
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed (jpg, png, webp, gif)'), false);
    }
    cb(null, true);
  }
});

router.post("/me/profile-picture", requireAuth, profilePicUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const user = await identity.users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });

    
    if (user.profilePictureGcsPath) {
      try {
        await deleteObject(user.profilePictureGcsPath);
      } catch (delErr) {
        logger.warn('[ProfilePic] Could not delete old picture object:', delErr.message);
      }
    }

    
    const gcsResult = await uploadObject(req.file, 'profiles', { userId: req.user.sub });

    await identity.users.update(req.user.sub, {
      profilePicture: gcsResult.url,
      profilePictureGcsPath: gcsResult.gcsPath,
    });

    return res.json({
      message: 'Profile picture updated',
      profilePicture: gcsResult.url,
    });
  } catch (err) {
    logger.error({ err }, 'PROFILE PIC UPLOAD ERROR');
    return res.status(500).json({ message: 'Upload failed' });
  }
});

router.delete("/me/profile-picture", requireAuth, async (req, res) => {
  try {
    const user = await identity.users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profilePictureGcsPath) {
      try {
        await deleteObject(user.profilePictureGcsPath);
      } catch (delErr) {
        logger.warn('[ProfilePic] Could not delete picture object on removal:', delErr.message);
      }
    }

    await identity.users.update(req.user.sub, { profilePicture: null, profilePictureGcsPath: null });

    return res.json({ message: 'Profile picture removed' });
  } catch (err) {
    logger.error('PROFILE PIC DELETE ERROR:', err);
    return res.status(500).json({ message: 'Failed to remove profile picture' });
  }
});

router.post("/me/emails", requireAuth, addEmail);
router.post("/me/emails/:id/verify", requireAuth, verifyEmailCode);
router.post("/me/emails/:id/resend", requireAuth, resendVerification);
router.put("/me/emails/:id/primary", requireAuth, setPrimaryEmail);
router.delete("/me/emails/:id", requireAuth, deleteEmail);

router.post("/me/deactivate", requireAuth, deactivateAccount);
router.post("/reactivate/verify-otp", verifyReactivationOTP);

const {
  getPrivacyPreferences,
  updatePrivacyPreferences,
  getRegionPreferences,
  updateRegionPreferences,
} = require("./accountPreferences");
router.get("/me/preferences/privacy", requireAuth, getPrivacyPreferences);
router.put("/me/preferences/privacy", requireAuth, updatePrivacyPreferences);

const { getNotificationPreferences, updateNotificationPreferences } = require("./notificationPreferences");
router.get("/me/preferences/notifications", requireAuth, getNotificationPreferences);
router.put("/me/preferences/notifications", requireAuth, updateNotificationPreferences);

router.get("/me/preferences/region", requireAuth, getRegionPreferences);
router.put("/me/preferences/region", requireAuth, updateRegionPreferences);

// blockedUsers entries are { userId, blockedAt }.
router.get("/me/blocked-users", requireAuth, async (req, res) => {
  try {
    const { hydrate, userSelect } = require("../../identity/hydrate");
    const me = await identity.users.findById(req.user.sub);
    const user = { blockedUsers: (me?.social?.blockedUsers || []).map((b) => ({ ...b })) };
    await hydrate(user, { 'blockedUsers.userId': userSelect('username email profilePicture') });

    const list = (user?.blockedUsers || [])
      .filter(b => b && b.userId)
      .map(b => ({
        _id: b.userId._id || b.userId,
        userId: b.userId._id || b.userId,
        username: b.userId.username || null,
        email: b.userId.email || null,
        profilePicture: b.userId.profilePicture || null,
        blockedAt: b.blockedAt || null,
      }));
    res.json(list);
  } catch (error) {
    logger.error("GET BLOCKED USERS ERROR:", error);
    res.status(500).json({ message: "Failed to load blocked users" });
  }
});

router.delete("/me/blocked-users/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(String(userId))) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const me = await identity.users.findById(req.user.sub);
    const social = me?.social || {};
    const blockedUsers = (social.blockedUsers || []).filter((b) => String(b.userId) !== String(userId));
    await identity.users.update(req.user.sub, { social: { ...social, blockedUsers } });

    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    logger.error("UNBLOCK USER ERROR:", error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

router.get("/sessions", requireAuth, getSessions);
router.delete("/sessions/others", requireAuth, revokeOtherSessions);
router.delete("/sessions/:id", requireAuth, revokeSession);

router.get("/users", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.sub;
    // Company accounts only see their own company. Personal accounts see other personal
    // accounts, minus those who turned discovery off and share no workspace with them.
    const users = await discoverablePeople(currentUserId, { limit: 100 });

    res.json({ users });
  } catch (err) {
    logger.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  

const passport = require("../../../config/passport");
const { userDocs } = require("../../identity/queries/auth");
const jwt = require("jsonwebtoken");

// Access token goes in the URL fragment (never the query string) so it does not reach
// server logs, Referer headers or proxies. Format: /oauth-success#access=<jwt>&requiresPasswordSetup=<bool>
const oauthSuccessRedirect = (res, user, token) => {
  const requiresPasswordSetup = user.authProvider !== 'local' && !user.passwordSetAt && !user.passwordSkipped;
  const params = new URLSearchParams({ access: token, requiresPasswordSetup: String(requiresPasswordSetup) });
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success#${params.toString()}`);
};

const generateToken = (user) => {
  return jwt.sign(
    { sub: user._id, username: user.username, role: user.roles?.[0] || 'user' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' } 
  );
};

// GitHub sign-in is optional (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).
const requireGithubConfigured = (req, res, next) => {
  if (passport.githubConfigured) return next();
  return res.status(503).json({ message: "GitHub sign-in is not configured on this server" });
};

router.get(
  "/github",
  requireGithubConfigured,
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  requireGithubConfigured,
  passport.authenticate("github", { session: false, failureRedirect: "/login?error=github_failed" }),
  (req, res) => {
    
    const token = generateToken(req.user);
    oauthSuccessRedirect(res, req.user, token);
  }
);

router.get("/linkedin", (req, res) => {
  
  
  const { randomBytes } = require('crypto');
  const state = randomBytes(16).toString('hex');

  
  
  res.cookie('linkedin_oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 5 * 60 * 1000,           
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
      logger.error('LinkedIn OAuth error:', error, error_description);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
    }

    
    
    
    const storedState = req.cookies?.linkedin_oauth_state;
    if (!state || !storedState || state !== storedState) {
      logger.error('LinkedIn OAuth: state mismatch — potential CSRF attack');
      res.clearCookie('linkedin_oauth_state');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_state_mismatch`);
    }
    
    res.clearCookie('linkedin_oauth_state');

    
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

    
    const userInfoRes = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const linkedinUser = userInfoRes.data;
    logger.info('LinkedIn user profile:', linkedinUser);

    
    let user = await userDocs.findByProvider('linkedin', linkedinUser.sub);

    if (!user && linkedinUser.email) {
      
      user = await userDocs.findByEmail(linkedinUser.email);
      if (user) {
        // Only link to an existing account when that account's email is verified,
        // it is not already linked elsewhere, and LinkedIn vouches for the email.
        // Otherwise an attacker could take over an account by registering its email.
        if (!user.verified || user.linkedinId || linkedinUser.email_verified === false) {
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_exists`);
        }
        user.linkedinId = linkedinUser.sub;
        if (linkedinUser.picture) user.profilePicture = linkedinUser.picture;
        await user.save();
      }
    }

    if (!user) {
      
      user = await userDocs.create({
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
    
    oauthSuccessRedirect(res, user, token);
  } catch (err) {
    logger.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
});

module.exports = router;
