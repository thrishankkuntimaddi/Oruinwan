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
// TOKEN HELPERS
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
exports.signup = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = sha256(rawToken);

    const user = new User({
      username,
      email,
      phone,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpires: Date.now() + 86400000, // 24 hrs
    });

    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`,
    });

    // 👉 ADD THIS BACK — critical for development
    console.log("\n=============================================");
    console.log("DEV verification link (copy/paste into browser):");
    console.log(verifyUrl);
    console.log("=============================================\n");

    return res
      .status(201)
      .json({ message: "Signup successful, check email for verification" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ---------------------------
// VERIFY EMAIL
// ---------------------------
exports.verifyEmail = async (req, res) => {
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

    return res.json({ message: "Email verified" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// LOGIN
// ---------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshTokenHash = sha256(refreshToken);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    await user.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_DAYS * 86400000,
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
};

// ---------------------------
// REFRESH TOKEN
// ---------------------------
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.jwt;
    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token" });

    const refreshTokenHash = sha256(refreshToken);

    const user = await User.findOne({
      "refreshTokens.tokenHash": refreshTokenHash,
    });

    if (!user)
      return res.status(403).json({ message: "Invalid refresh token" });

    try {
      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(403).json({ message: "Expired refresh token" });
    }

    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);
    const newHash = sha256(newRefresh);

    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.tokenHash !== refreshTokenHash
    );

    user.refreshTokens.push({
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    await user.save();

    res.cookie("jwt", newRefresh, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_DAYS * 86400000,
    });

    return res.json({ accessToken: newAccess });

  } catch (err) {
    console.error("REFRESH ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// LOGOUT
// ---------------------------
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token)
      return res.json({ message: "Logged out" });

    const tokenHash = sha256(token);

    const user = await User.findOne({
      "refreshTokens.tokenHash": tokenHash,
    });

    if (user) {
      user.refreshTokens = user.refreshTokens.filter(
        (t) => t.tokenHash !== tokenHash
      );
      await user.save();
    }

    res.clearCookie("jwt", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    return res.json({ message: "Logged out" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// LOGOUT ALL
// ---------------------------
exports.logoutAll = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token)
      return res.json({ message: "Logged out from all devices" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      res.clearCookie("jwt");
      return res.json({ message: "Logged out all" });
    }

    await User.findByIdAndUpdate(decoded.sub, { refreshTokens: [] });

    res.clearCookie("jwt");
    return res.json({ message: "Logged out from all devices" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// FORGOT PASSWORD
// ---------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });

    if (!user)
      return res.json({ message: "If that email exists, a reset link was sent" });

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = sha256(raw);

    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const url = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: "Password Reset",
      html: `Reset your password: <a href="${url}">${url}</a>`,
    });

    return res.json({
      message: "If that email exists, a reset link was sent",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// RESET PASSWORD
// ---------------------------
exports.resetPassword = async (req, res) => {
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
      return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];

    await user.save();

    return res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error("RESET ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// GET /me
// ---------------------------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("-passwordHash -refreshTokens");
    if (!user)
      return res.status(404).json({ message: "User not found" });

    return res.json(user);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// UPDATE PROFILE
// ---------------------------
// PUT /me - update user profile
// PUT /me - update user profile
exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Update top-level fields
    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.phone !== undefined) user.phone = req.body.phone;

    // Ensure profile exists
    if (!user.profile) user.profile = {};

    // Update nested profile fields
    if (req.body.dob !== undefined) user.profile.dob = req.body.dob;
    if (req.body.about !== undefined) user.profile.about = req.body.about;
    if (req.body.company !== undefined) user.profile.company = req.body.company;
    if (req.body.showCompany !== undefined)
      user.profile.showCompany = req.body.showCompany;

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
        roles: user.roles
      }
    });

  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);

    if (err.code === 11000) {
      if (err.keyPattern?.phone) {
        return res.status(400).json({ message: "Phone already in use" });
      }
      if (err.keyPattern?.username) {
        return res.status(400).json({ message: "Username already in use" });
      }
    }

    return res.status(500).json({ message: "Server error" });
  }
};



// ---------------------------
// UPDATE PASSWORD
// ---------------------------
exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res.status(400).json({ message: "Missing fields" });

    const strong =
      newPassword.length >= 8 &&
      newPassword.length <= 16 &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!strong)
      return res.status(400).json({ message: "Weak password" });

    const user = await User.findById(req.user.sub);

    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Old password incorrect" });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ message: "Password updated" });

  } catch (err) {
    console.error("PASSWORD ERROR", err);
    return res.status(500).json({ message: "Server error" });
  }
};
