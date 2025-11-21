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
// ACCESS & REFRESH TOKEN GENERATORS
// ---------------------------
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      roles: user.roles,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` }
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

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Hash refresh token
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Store hashed refresh token (for rotation)
user.refreshTokens.push({
  tokenHash: refreshTokenHash,
  expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
  deviceInfo: req.get("User-Agent") || "Unknown"
});


    await user.save();

    // Set cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false, // change to true in prod
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
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
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}


// ---------------------------
// REFRESH TOKEN (FIXED FOR YOUR SCHEMA)
// ---------------------------
// ---------------------------
// REFRESH TOKEN (FULLY FIXED)
// ---------------------------
async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.jwt;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Hash the incoming refresh token
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Find user whose tokenHash matches
    const user = await User.findOne({
      "refreshTokens.tokenHash": refreshTokenHash,
    });

    if (!user) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Verify signature of refresh token
    try {
      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(403).json({ message: "Expired refresh token" });
    }

    // Create new tokens (ROTATION)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Hash new refresh token
    const newRefreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    // Remove old token
    user.refreshTokens = user.refreshTokens.filter(
      (rt) => rt.tokenHash !== refreshTokenHash
    );

    // Add new refresh token
    user.refreshTokens.push({
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    await user.save();

    // Set new cookie
    res.cookie("jwt", newRefreshToken, {
      httpOnly: true,
      secure: false, // change to true in production
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken: newAccessToken,
    });

  } catch (err) {
    console.error("REFRESH ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
}



// ---------------------------
// LOGOUT
// ---------------------------
async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.jwt;
    if (!refreshToken) {
      return res.status(200).json({ message: "Logged out successfully" });
    }

    // Hash the refresh token
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Find user who owns this refresh token
    const user = await User.findOne({ refreshTokens: refreshTokenHash });

    if (user) {
      // Remove ONLY this refresh token hash
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token !== refreshTokenHash
      );
      await user.save();
    }

    // Clear cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    return res.json({ message: "Logged out successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

async function logoutAll(req, res) {
  try {
    const refreshToken = req.cookies?.jwt;
    if (!refreshToken) {
      return res.status(200).json({ message: "Logged out from all devices" });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      // Even if invalid, clear cookie
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });
      return res.json({ message: "Logged out from all devices" });
    }

    // Clear ALL refresh tokens for this user
    await User.findByIdAndUpdate(decoded.id, { refreshTokens: [] });

    res.clearCookie("jwt", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    return res.json({ message: "Logged out from all devices" });

  } catch (err) {
    console.error(err);
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
