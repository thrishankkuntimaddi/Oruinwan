// server/controllers/authController.js

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10);

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), roles: user.roles },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: `${REFRESH_DAYS}d` }
  );
}

// ----------------------------------------------------
// SIGNUP
// ----------------------------------------------------
exports.signup = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    const user = new User({
      username,
      email,
      phone,
      passwordHash,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: Date.now() + 86400000,
    });

    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    console.log("\n" + "=".repeat(80));
    console.log("📧 EMAIL VERIFICATION REQUIRED");
    console.log("User:", username);
    console.log("Email:", email);
    console.log("Verify URL:", verifyUrl);
    console.log("=".repeat(80) + "\n");

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`
    });

    return res.status(201).json({ message: "Signup successful, verify your email." });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// VERIFY EMAIL
// ----------------------------------------------------
exports.verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    const user = await User.findOne({
      email,
      verificationTokenHash: sha256(token),
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    return res.json({ message: "Email verified" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// LOGIN
// ----------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });

    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    // If Google account → block password login
    if (user.googleAccount) {
      return res.status(400).json({
        message: "This account uses Google Sign-In. Please login using Google.",
      });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    // Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = sha256(refreshToken);

    user.refreshTokens.push({
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    await user.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_DAYS * 86400000,
    });

    return res.json({
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        verified: user.verified,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ----------------------------------------------------
// REFRESH TOKEN
// ----------------------------------------------------
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.jwt;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    const refreshHash = sha256(refreshToken);

    const user = await User.findOne({
      "refreshTokens.tokenHash": refreshHash
    });

    if (!user) return res.status(403).json({ message: "Invalid refresh token" });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);

    // CRITICAL FIX: Don't remove old token immediately!
    // Instead, mark it with a grace period to handle race conditions
    // (React StrictMode, double requests, etc.)
    const oldTokenIndex = user.refreshTokens.findIndex(t => t.tokenHash === refreshHash);

    if (oldTokenIndex !== -1) {
      // Keep old token but mark it as expiring soon (10 second grace period)
      user.refreshTokens[oldTokenIndex].expiresAt = new Date(Date.now() + 10000);
    }

    // Add new refresh token
    user.refreshTokens.push({
      tokenHash: sha256(newRefresh),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown"
    });

    // Clean up truly expired tokens
    user.refreshTokens = user.refreshTokens.filter(
      t => t.expiresAt > new Date()
    );

    await user.save();

    res.cookie("jwt", newRefresh, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_DAYS * 86400000
    });

    return res.json({ accessToken: newAccess });

  } catch (err) {
    console.error("REFRESH ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// LOGOUT
// ----------------------------------------------------
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return res.json({ message: "Logged out" });

    const hash = sha256(token);

    const user = await User.findOne({ "refreshTokens.tokenHash": hash });

    if (user) {
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== hash);
      await user.save();
    }

    res.clearCookie("jwt");

    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// LOGOUT ALL
// ----------------------------------------------------
exports.logoutAll = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return res.json({ message: "Logged out from all devices" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      res.clearCookie("jwt");
      return res.json({ message: "Logged out" });
    }

    await User.findByIdAndUpdate(decoded.sub, { refreshTokens: [] });

    res.clearCookie("jwt");

    return res.json({ message: "Logged out from all devices" });

  } catch (err) {
    console.error("LOGOUT ALL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// FORGOT PASSWORD
// ----------------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ NO USER FOUND for email:", email);
      return res.json({ message: "If that email exists, reset link sent" });
    }

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = sha256(raw);

    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const url = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;

    console.log("\n" + "=".repeat(80));
    console.log("🔐 PASSWORD RESET REQUEST");
    console.log("Email:", email);
    console.log("Reset URL:", url);
    console.log("=".repeat(80) + "\n");

    await sendEmail({
      to: email,
      subject: "Password Reset",
      html: `Reset your password: <a href="${url}">${url}</a>`
    });

    return res.json({ message: "Reset link sent if account exists" });
  } catch (err) {
    console.error("FORGOT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ----------------------------------------------------
// RESET PASSWORD
// ----------------------------------------------------
exports.resetPassword = async (req, res) => {
  try {
    const { token, email, password } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordTokenHash: sha256(token),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];

    await user.save();

    return res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error("RESET ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// GET /me
// ----------------------------------------------------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select(
      "-passwordHash -refreshTokens"
    );

    return res.json(user);
  } catch (err) {
    console.error("GET ME ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// UPDATE PROFILE
// ----------------------------------------------------
exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);

    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.phone !== undefined) user.phone = req.body.phone;

    if (!user.profile) user.profile = {};

    user.profile.dob = req.body.dob ?? user.profile.dob;
    user.profile.about = req.body.about ?? user.profile.about;
    user.profile.company = req.body.company ?? user.profile.company;
    user.profile.showCompany = req.body.showCompany ?? user.profile.showCompany;

    await user.save();

    return res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        dob: user.profile?.dob || "",
        about: user.profile?.about || "",
        company: user.profile?.company || "",
        showCompany: user.profile?.showCompany ?? true,
        verified: user.verified,
        roles: user.roles,
      }
    });

  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// UPDATE PASSWORD
// ----------------------------------------------------
exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.sub);

    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Old password incorrect" });

    const strong =
      newPassword.length >= 8 &&
      newPassword.length <= 16 &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!strong)
      return res.status(400).json({ message: "Weak password" });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ message: "Password updated" });

  } catch (err) {
    console.error("PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// GOOGLE LOGIN (FINAL)
// ----------------------------------------------------
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Missing Google token" });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });

    // CREATE USER IF NEW
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const randomHash = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
        username: name,
        email,
        verified: true,
        googleId,
        profilePicture: picture,
        googleAccount: true,
        passwordHash: randomHash, // <-- SAFE DEFAULT
      });
    }

    // TOKENS
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push({
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    await user.save();

    // COOKIE
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Google login success",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });

  } catch (err) {
    console.error("GOOGLE LOGIN ERROR:", err);
    return res.status(500).json({ message: "Google login failed" });
  }
};

// ----------------------------------------------------
// OPTIONAL REDIRECT GOOGLE FLOW
// ----------------------------------------------------
exports.googleAuth = exports.googleLogin;
