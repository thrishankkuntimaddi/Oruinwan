// server/controllers/authController.js

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");

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
// SIGNUP (with Company Assignment Logic)
// ----------------------------------------------------
exports.signup = async (req, res) => {
  try {
    const { username, email, password, phone, inviteToken } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    // Initialize user data
    let userType = "personal";
    let companyId = null;
    let companyRole = "member";
    let workspacesToJoin = [];

    // ==================== COMPANY ASSIGNMENT LOGIC ====================

    const emailLower = email.toLowerCase();
    const Company = require("../models/Company");
    const Invite = require("../models/Invite");
    const Workspace = require("../models/Workspace");
    const Channel = require("../models/Channel");

    // Helper to extract domain
    const extractDomain = (email) => {
      const match = email.match(/@(.+)$/);
      return match ? match[1].toLowerCase() : null;
    };

    // 1. Check for pending invite (highest priority)
    if (inviteToken) {
      const inviteHash = sha256(inviteToken);
      const invite = await Invite.findOne({
        tokenHash: inviteHash,
        email: emailLower,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (invite) {
        userType = "company";
        companyId = invite.company;
        companyRole = invite.role || "member";

        if (invite.workspace) {
          workspacesToJoin.push(invite.workspace);
        }

        // Mark invite as used
        invite.used = true;
        await invite.save();

        console.log(`✅ Signup via INVITE: ${email} → Company ${companyId}`);
      }
    }

    // 2. Check if email is in any company's allowedEmails list
    if (!companyId) {
      const companyWithAllowedEmail = await Company.findOne({
        allowedEmails: emailLower,
        isActive: true
      });

      if (companyWithAllowedEmail) {
        userType = "company";
        companyId = companyWithAllowedEmail._id;
        companyRole = companyWithAllowedEmail.invitePolicy?.defaultRole || "member";

        if (companyWithAllowedEmail.defaultWorkspace) {
          workspacesToJoin.push(companyWithAllowedEmail.defaultWorkspace);
        }

        console.log(`✅ Signup via ALLOWED EMAIL: ${email} → ${companyWithAllowedEmail.name}`);
      }
    }

    // 3. Check for domain-based auto-join (if domain verified + auto-join enabled)
    if (!companyId) {
      const domain = extractDomain(emailLower);

      if (domain) {
        const companyWithDomain = await Company.findOne({
          domain,
          domainVerified: true,
          autoJoinByDomain: true,
          isActive: true
        });

        if (companyWithDomain) {
          userType = "company";
          companyId = companyWithDomain._id;
          companyRole = companyWithDomain.invitePolicy?.defaultRole || "member";

          if (companyWithDomain.defaultWorkspace) {
            workspacesToJoin.push(companyWithDomain.defaultWorkspace);
          }

          console.log(`✅ Signup via DOMAIN AUTO-JOIN: ${email} → ${companyWithDomain.name} (${domain})`);
        }
      }
    }

    // If no company match, user remains personal
    if (!companyId) {
      console.log(`ℹ️  Personal user signup: ${email}`);
    }

    // ==================== CREATE USER ====================

    const user = new User({
      username,
      email: emailLower,
      phone,
      passwordHash,
      userType,
      companyId,
      companyRole,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: Date.now() + 86400000,
      verified: true // Auto-verify for testing (change in production)
    });

    await user.save();

    // ==================== WORKSPACE ASSIGNMENT ====================

    if (companyId && workspacesToJoin.length > 0) {
      for (const workspaceId of workspacesToJoin) {
        const workspace = await Workspace.findById(workspaceId);

        if (workspace && !workspace.isMember(user._id)) {
          // Add user to workspace
          workspace.members.push({
            user: user._id,
            role: "member"
          });
          await workspace.save();

          // Add workspace to user's workspaces array
          user.workspaces.push({
            workspace: workspaceId,
            role: "member"
          });

          // Add to default channels in this workspace
          const defaultChannels = await Channel.find({
            workspace: workspaceId,
            isDefault: true
          });

          for (const channel of defaultChannels) {
            // Check if already member (handle both old and new format)
            const isAlreadyMember = channel.members.some(m => {
              const memberId = m.user ? m.user.toString() : m.toString();
              return memberId === user._id.toString();
            });

            if (!isAlreadyMember) {
              // 🔧 FIX: Convert all existing members to new format before adding new member
              channel.members = channel.members.map(m => {
                if (m.user) return m;
                return {
                  user: m,
                  joinedAt: channel.createdAt || new Date()
                };
              });

              channel.members.push({
                user: user._id,
                joinedAt: new Date()
              });
              await channel.save();
              console.log(`   → Added to channel: #${channel.name}`);
            }
          }

          console.log(`   → Added to workspace: ${workspace.name}`);
        }
      }

      await user.save();
    }

    // NOTE: Removed automatic personal workspace creation
    // Users will now create workspaces manually from the /workspaces page

    // ==================== EMAIL VERIFICATION (OPTIONAL) ====================

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    console.log("\n" + "=".repeat(80));
    console.log("📧 NEW USER SIGNUP");
    console.log("User:", username);
    console.log("Email:", email);
    console.log("Type:", userType);
    if (companyId) {
      console.log("Company ID:", companyId);
      console.log("Role:", companyRole);
    }
    console.log("Verify URL:", verifyUrl);
    console.log("=".repeat(80) + "\n");

    /*
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`
    });
    */

    return res.status(201).json({
      message: "Signup successful, verify your email.",
      userType,
      companyId: companyId || null
    });

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

    const user = await User.findOne({ email }).populate("companyId", "name domain defaultWorkspace");

    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    // Check if company user
    if (user.companyId) {
      const Company = require("../models/Company");
      const company = await Company.findById(user.companyId);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (!company.isActive) {
        return res.status(403).json({ message: "Company is inactive" });
      }
    }

    // Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = sha256(refreshToken);

    // Enforce Max 3 Sessions (FIFO)
    // Remove oldest sessions if we have 3 or more before adding the new one
    // We sort just to be safe, though usually they are in order
    if (user.refreshTokens.length >= 3) {
      user.refreshTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      while (user.refreshTokens.length >= 3) {
        user.refreshTokens.shift(); // Remove oldest
      }
    }

    user.refreshTokens.push({
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    // Update last login
    user.lastLoginAt = new Date();
    user.isOnline = true;

    await user.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: REFRESH_DAYS * 86400000,
    });

    // Prepare response based on user type
    const response = {
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        verified: user.verified,
        userType: user.userType,
        companyRole: user.companyRole,
        profilePicture: user.profilePicture,
        userStatus: user.userStatus,
        preferences: user.preferences
      }
    };

    // Add company info if company user
    if (user.companyId) {
      response.company = {
        id: user.companyId._id,
        name: user.companyId.name,
        domain: user.companyId.domain,
        defaultWorkspace: user.companyId.defaultWorkspace
      };

      // Check if user is admin/owner
      const isAdmin = user.companyRole === "owner" || user.companyRole === "admin";
      response.isAdmin = isAdmin;

      // Set redirect URL
      if (isAdmin) {
        response.redirectTo = "/admin/dashboard"; // Admin dashboard
      } else {
        response.redirectTo = "/workspace"; // Regular workspace view
      }
    } else {
      // Personal user
      response.redirectTo = "/personal/workspace";
    }

    return res.json(response);

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

    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.phone !== undefined) user.phone = req.body.phone;

    // Profile Updates
    if (!user.profile) user.profile = {};
    if (req.body.dob !== undefined) user.profile.dob = req.body.dob;
    if (req.body.about !== undefined) user.profile.about = req.body.about;
    if (req.body.company !== undefined) user.profile.company = req.body.company;
    if (req.body.showCompany !== undefined) user.profile.showCompany = req.body.showCompany;

    // Preference Updates
    if (!user.preferences) user.preferences = {};
    if (req.body.preferences) {
      if (req.body.preferences.theme) user.preferences.theme = req.body.preferences.theme;
    }

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
        showCompany: user.profile?.showCompany ?? true,
        verified: user.verified,
        roles: user.roles,
        userStatus: user.userStatus,
        preferences: user.preferences
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
    const { credential, accessToken: googleAccessToken } = req.body;

    let email, name, picture, googleId;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      googleId = payload.sub;
    } else if (googleAccessToken) {
      const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      email = response.data.email;
      name = response.data.name;
      picture = response.data.picture;
      googleId = response.data.sub;
    } else {
      return res.status(400).json({ message: "Missing Google token" });
    }

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
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        userStatus: user.userStatus,
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

// ----------------------------------------------------
// SESSION MANAGEMENT
// ----------------------------------------------------

// GET /sessions
exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Identify current session
    const currentToken = req.cookies?.jwt;
    const currentHash = currentToken ? sha256(currentToken) : null;

    // ---------------------------------------------------------
    // AUTO-CLEANUP: Enforce Max 3 Sessions Policy on Read
    // ---------------------------------------------------------
    if (user.refreshTokens.length > 3) {
      // Sort: Current first, then Newest to Oldest
      // We want to KEEP: Current + (2 newest others)
      const tokens = user.refreshTokens.map(t => ({
        ...t.toObject(),
        isCurrent: t.tokenHash === currentHash
      }));

      tokens.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Keep top 3
      const keepTokens = tokens.slice(0, 3);

      // Update DB with only kept tokens
      // We need to map back to the original schema format (removing isCurrent prop)
      user.refreshTokens = keepTokens.map(t => ({
        tokenHash: t.tokenHash,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        deviceInfo: t.deviceInfo,
        _id: t._id // Preserve ID
      }));

      await user.save();
    }
    // ---------------------------------------------------------

    const sessions = user.refreshTokens.map(t => {
      // Simple parser for device info (User-Agent)
      let deviceType = "desktop";
      const ua = (t.deviceInfo || "").toLowerCase();

      // Basic Detection
      if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
        deviceType = "mobile";
      }

      // Detailed OS Name
      let deviceName = "Unknown Device";
      if (ua.includes("mac os")) deviceName = "MacBook / Mac";
      else if (ua.includes("windows")) deviceName = "Windows PC";
      else if (ua.includes("iphone")) deviceName = "iPhone";
      else if (ua.includes("android")) deviceName = "Android Device";
      else if (ua.includes("linux")) deviceName = "Linux Machine";
      else if (ua.includes("cros")) deviceName = "Chromebook";

      // Browser Detection to differentiate "MacBook" sessions
      let browser = "";
      if (ua.includes("chrome") && !ua.includes("edg") && !ua.includes("opr")) browser = "Chrome";
      else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
      else if (ua.includes("firefox")) browser = "Firefox";
      else if (ua.includes("edg")) browser = "Edge";
      else if (ua.includes("opr")) browser = "Opera";

      return {
        id: t._id,
        device: deviceName,
        browser: browser, // Send specific browser info
        os: deviceType,
        location: "Unknown",
        lastActive: t.createdAt,
        current: t.tokenHash === currentHash
      };
    });

    // Sort for Response: Current first, then by date desc
    sessions.sort((a, b) => {
      if (a.current) return -1;
      if (b.current) return 1;
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    res.json(sessions);
  } catch (err) {
    console.error("GET SESSIONS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /sessions/:id
exports.revokeSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const user = await User.findById(req.user.sub);

    // If session ID matches current session, maybe we should warn or just do it (logout)
    // But usually client handles "current" logout via /logout endpoint
    // This endpoint is for revoking *other* sessions usually

    user.refreshTokens.pull({ _id: sessionId });
    await user.save();

    res.json({ message: "Session revoked" });
  } catch (err) {
    console.error("REVOKE SESSION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /sessions/others
exports.revokeOtherSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    const currentToken = req.cookies?.jwt;

    if (!currentToken) {
      return res.status(400).json({ message: "No active session to keep" });
    }

    const currentHash = sha256(currentToken);

    // Keep ONLY the current session
    user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash === currentHash);

    await user.save();

    res.json({ message: "All other sessions revoked" });
  } catch (err) {
    console.error("REVOKE OTHERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
