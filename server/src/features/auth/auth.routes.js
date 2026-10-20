const logger = require('../../../utils/logger');
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
router.post("/google-signup", require("./auth.controller").googleSignup);
router.post("/resend-verification", require("./auth.controller").resendSignupVerification);

// Passkeys (WebAuthn): sign-in without a password, managed under Settings → Security.
router.use("/passkeys", require("./passkeys"));

// Sign-in methods: Google and email + password. The login page shows only what this server offers.
router.get("/providers", (req, res) => {
  res.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    // Public by design (it is in every page that shows Google's sign-in); the phone app reads it here.
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    sms: require('../../shared/services/otpProof').smsConfigured(),
  });
});

module.exports = router;
