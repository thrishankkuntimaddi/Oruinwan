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
  getSessions,
  revokeSession,
  revokeOtherSessions
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

module.exports = router;
