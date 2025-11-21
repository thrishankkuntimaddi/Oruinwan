// server/controllers/authController.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10);

// ---------------------------
// ACCESS TOKEN
// ---------------------------
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), roles: user.roles },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

// ---------------------------
// SIGNUP
// ---------------------------
async function signup(req, res) {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = sha256(verificationToken);

    const user = new User({
      username,
      email,
      phone,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpires: Date.now() + 86400000, // 24h
    });

    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(
      email
    )}`;

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`,
    });

    console.log("DEV email verify link:", verifyUrl);

    return res
      .status(201)
      .json({ message: "Signup successful, check email for verification" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// VERIFY EMAIL
// ---------------------------
async function verifyEmail(req, res) {
  try {
    const { token, email } = req.query;

    const tokenHash = sha256(token);

    const user = await User.findOne({
      email,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    res.json({ message: "Email verified" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// LOGIN (FULLY FIXED)
// ---------------------------
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Missing email or password" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res
        .status(403)
        .json({ message: "Please verify your email before login" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // ---------------------------
    // Generate ACCESS token
    // ---------------------------
    const accessToken = signAccessToken(user);

    // ---------------------------
    // Generate REFRESH token
    // ---------------------------
    const refreshRaw = crypto.randomBytes(40).toString("hex");
    const refreshHash = sha256(refreshRaw);

    user.refreshTokens.push({
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
    });

    await user.save();

    // Set cookie
    res.cookie("jwt", refreshRaw, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_DAYS * 86400000,
    });

    return res.json({
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        roles: user.roles,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// REFRESH TOKEN
// ---------------------------
async function refresh(req, res) {
  try {
    const raw = req.cookies.jwt;
    if (!raw) return res.status(401).json({ message: "No refresh token" });

    const tokenHash = sha256(raw);

    const user = await User.findOne({
      "refreshTokens.tokenHash": tokenHash,
    });

    if (!user) {
      res.clearCookie("jwt");
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const record = user.refreshTokens.find((t) => t.tokenHash === tokenHash);

    if (!record || record.expiresAt < Date.now()) {
      user.refreshTokens = user.refreshTokens.filter(
        (t) => t.tokenHash !== tokenHash
      );
      await user.save();
      res.clearCookie("jwt");
      return res.status(401).json({ message: "Expired token" });
    }

    // ROTATE TOKEN
    const rawNew = crypto.randomBytes(40).toString("hex");
    const newHash = sha256(rawNew);

    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.tokenHash !== tokenHash
    );

    user.refreshTokens.push({
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
    });

    await user.save();

    res.cookie("jwt", rawNew, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_DAYS * 86400000,
    });

    const accessToken = signAccessToken(user);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error("REFRESH ERROR", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// LOGOUT
// ---------------------------
async function logout(req, res) {
  try {
    const raw = req.cookies.jwt;
    if (raw) {
      const hash = sha256(raw);
      await User.updateOne(
        { "refreshTokens.tokenHash": hash },
        { $pull: { refreshTokens: { tokenHash: hash } } }
      );
      res.clearCookie("jwt");
    }

    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("LOGOUT ERROR", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// FORGOT PASSWORD
// ---------------------------
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });

    // Always respond OK even if user not found (security)
    if (!user)
      return res.json({
        message: "If that email exists, a reset link has been sent",
      });

    const rawReset = crypto.randomBytes(32).toString("hex");
    const resetHash = sha256(rawReset);

    user.resetPasswordTokenHash = resetHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawReset}&email=${encodeURIComponent(
      email
    )}`;

    await sendEmail({
      to: email,
      subject: "Password reset",
      html: `Click to reset: <a href="${resetUrl}">${resetUrl}</a>`,
    });

    return res.json({
      message: "If that email exists, a reset link has been sent",
    });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// ---------------------------
// RESET PASSWORD
// ---------------------------
async function resetPassword(req, res) {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password)
      return res.status(400).json({ message: "Invalid request" });

    const hash = sha256(token);

    const user = await User.findOne({
      email,
      resetPasswordTokenHash: hash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;

    // Invalidate all refresh tokens
    user.refreshTokens = [];

    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
}


module.exports = {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
