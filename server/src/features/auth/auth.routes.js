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
const { discoverableFilter } = require("./privacy.service");

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
const { uploadToGCS } = require('../../modules/uploads/upload.service');
const { Storage } = require('@google-cloud/storage');
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chttrix-uploads';

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
    const User = require("../../../models/User");
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const user = await User.findById(req.user.sub).select('profilePicture profilePictureGcsPath');
    if (!user) return res.status(404).json({ message: 'User not found' });

    
    if (user.profilePictureGcsPath) {
      try {
        const storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod' });
        await storageClient.bucket(BUCKET_NAME).file(user.profilePictureGcsPath).delete();
      } catch (delErr) {
        logger.warn('[ProfilePic] Could not delete old GCS file:', delErr.message);
      }
    }

    
    const gcsResult = await uploadToGCS(req.file, 'profiles', { userId: req.user.sub });

    await User.findByIdAndUpdate(req.user.sub, {
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
    const User = require("../../../models/User");
    const user = await User.findById(req.user.sub).select('profilePictureGcsPath');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profilePictureGcsPath) {
      try {
        const storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod' });
        await storageClient.bucket(BUCKET_NAME).file(user.profilePictureGcsPath).delete();
      } catch (delErr) {
        logger.warn('[ProfilePic] Could not delete GCS file on removal:', delErr.message);
      }
    }

    await User.findByIdAndUpdate(req.user.sub, {
      $unset: { profilePicture: 1, profilePictureGcsPath: 1 }
    });

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
    const User = require("../../../models/User");
    const user = await User.findById(req.user.sub)
      .select("blockedUsers")
      .populate("blockedUsers.userId", "_id username email profilePicture")
      .lean();

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
    const User = require("../../../models/User");
    const { userId } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(String(userId))) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    await User.findByIdAndUpdate(req.user.sub, {
      $pull: { blockedUsers: { userId } }
    });

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
    const User = require("../../../models/User");

    
    
    
    
    const currentUser = await User.findById(currentUserId).select('companyId').lean();

    // Company accounts only see their own company. Personal accounts see other personal
    // accounts, minus those who turned discovery off and share no workspace with them.
    const query = currentUser?.companyId
      ? { _id: { $ne: currentUserId }, companyId: currentUser.companyId }
      : {
        _id: { $ne: currentUserId },
        $and: [
          { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
          await discoverableFilter(currentUserId),
        ],
      };

    const users = await User.find(query)
      .select("_id username email profilePicture")
      .limit(100)
      .lean();

    res.json({ users });
  } catch (err) {
    logger.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/google-login", googleLogin);
router.post("/google", googleAuth);  

const passport = require("../../../config/passport");
const User = require("../../../models/User");
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

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
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

    
    let user = await User.findOne({ linkedinId: linkedinUser.sub });

    if (!user && linkedinUser.email) {
      
      user = await User.findOne({ email: linkedinUser.email });
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
    
    oauthSuccessRedirect(res, user, token);
  } catch (err) {
    logger.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
});

module.exports = router;
