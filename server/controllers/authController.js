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
    const { username, email, password, phone, phoneCode, inviteToken } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email already in use" });

    // Check for duplicate username
    if (await User.findOne({ username }))
      return res.status(409).json({ message: "Username already in use" });

    // Check for duplicate phone number (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone });
      if (existingPhone) {
        return res.status(409).json({ message: "Phone number already in use" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    // Initialize user data
    let userType = "personal";
    let companyId = null;
    let companyRole = "member";
    let workspacesToJoin = [];
    let assignedDepartment = null;
    let assignedManager = null;

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
        assignedDepartment = invite.department;
        assignedManager = invite.metadata?.managerId;

        if (invite.workspace) {
          workspacesToJoin.push(invite.workspace);
        }

        // Mark invite as used
        invite.status = 'accepted'; // Update status
        invite.used = true;
        invite.usedBy = null; // Will be set after user creation (requires slight flow adjustment or 2nd save)
        await invite.save();
      } else {
        // ... invalid token logic
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

        }
      }
    }

    // If no company match, user remains personal
    if (!companyId) {

    }

    // ==================== CREATE USER ====================

    const user = new User({
      username,
      email: emailLower,
      phone: phone || null,
      phoneCode: phoneCode || "+1",
      passwordHash,
      userType,
      companyId,
      companyRole,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: Date.now() + 86400000,
      verified: false, // Users must verify email before logging in,
      departments: assignedDepartment ? [assignedDepartment] : [],
      reportsTo: assignedManager
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

            }
          }

        }
      }

      await user.save();
    }

    // NOTE: Removed automatic personal workspace creation
    // Users will now create workspaces manually from the /workspaces page

    // ==================== EMAIL VERIFICATION (OPTIONAL) ====================

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    if (companyId) {

    }

    // Send verification email (or log to console in development)
    try {
      await sendEmail({
        to: email,
        subject: "Verify your email",
        html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`
      });
      console.log(`✅ Verification email sent successfully to ${email}`);
    } catch (emailError) {
      // Log the actual error
      console.error("❌ SMTP Error:", emailError.message);

      // If SMTP not configured, log the link to console (for development)
      console.log("\n" + "=".repeat(80));
      console.log("📧 EMAIL VERIFICATION LINK (SMTP not configured)");
      console.log("=".repeat(80));
      console.log(`User: ${email}`);
      console.log(`Verification Link: ${verifyUrl}`);
      console.log("=".repeat(80) + "\n");
    }

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

    console.log("🔐 [VERIFY EMAIL] Request received:");
    console.log(`   Email: ${email}`);
    console.log(`   Token: ${token ? token.substring(0, 10) + '...' : 'MISSING'}`);

    if (!token || !email) {
      console.log("❌ [VERIFY EMAIL] Missing token or email");
      return res.status(400).json({ message: "Missing token or email" });
    }

    const tokenHash = sha256(token);
    console.log(`   Token Hash: ${tokenHash.substring(0, 10)}...`);

    const user = await User.findOne({
      email,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log("❌ [VERIFY EMAIL] No matching user found");
      console.log("   Possible reasons: Invalid token, expired token, or email already verified");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    console.log(`✅ [VERIFY EMAIL] User found: ${user.email}`);

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    console.log(`✅ [VERIFY EMAIL] Email verified successfully for ${user.email}`);

    return res.json({ message: "Email verified" });
  } catch (err) {
    console.error("❌ [VERIFY EMAIL] ERROR:", err);
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

    const user = await User.findOne({ email }).populate("companyId", "name domain defaultWorkspace isSetupComplete setupStep");

    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    // Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    // -------------------------------------------------------------------------
    // STRICT DOMAIN & COMPANY VERIFICATION
    // -------------------------------------------------------------------------

    // 1. EXTRACT DOMAIN
    const matchDomain = email.match(/@(.+)$/);
    const domain = matchDomain ? matchDomain[1].toLowerCase() : null;

    // 2. CHECK COMPANY STATUS (If user belongs to a company)
    if (user.companyId) {
      const Company = require("../models/Company");
      // Populate company to check verification status
      const company = await Company.findById(user.companyId);

      if (!company) {
        // Data inconsistency: User has companyId but company not found
        // Treat as personal or error? safest is error.
        return res.status(403).json({ message: "Associated company not found. Contact support." });
      }

      // CHECK: Domain Verification
      if (company.domain && company.domain !== domain) {
        // This might happen if user email doesn't match company domain (e.g. guest).
        // But user requirement says: "check domain their in db or not"
        // If strict domain enforcement is needed:
        // if (company.domainVerified && !company.allowedEmails.includes(email)) ...
      }

      // CHECK: Company Verification Status (The "Admin" verification part)
      if (company.verificationStatus === 'rejected') {
        return res.status(403).json({
          message: `Company registration rejected: ${company.rejectionReason || "Contact Support"}`
        });
      }

      if (company.verificationStatus === 'pending') {
        // If user is the OWNER/ADMIN who registered it
        if (user.companyRole === 'owner' || user.companyRole === 'admin') {
          // Allow them to login ONLY to see "Pending" status or redirected to a status page?
          // Or block them?
          // Usually we block regular members, but maybe let admins see a "Pending" screen.
          // For now, blocking compliant with "we need to check... user verification".
          return res.status(403).json({ message: "Your company is pending verification. Please wait for approval." });
        } else {
          return res.status(403).json({ message: "Company verification pending. Access restricted." });
        }
      }

      if (!company.isActive) {
        return res.status(403).json({ message: "Company account is inactive." });
      }
    } else {
      // PERSONAL USER (companyId is null)
      // Requirement: "company_id = null : personal user" - Allowed.
      // Requirement: "domain verifications... in db or not"
      // If a personal user tries to login with a strict corporate domain that claims "Auto-Join",
      // we might want to flag it, but for Login, we usually just authenticate.
    }


    // Check for Account Status (e.g., Pending Company Verification)
    if (user.accountStatus === 'pending_company') {
      const company = user.companyId ? await require("../models/Company").findById(user.companyId) : null;
      if (company && company.verificationStatus === 'rejected') {
        return res.status(403).json({
          message: `Registration Rejected: ${company.rejectionReason || "Contact Support"}`
        });
      }
      return res.status(403).json({ message: "Verification Pending. You will receive an email once approved." });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ message: "Account Suspended." });
    }

    // Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = sha256(refreshToken);

    // Enforce Max 3 Sessions (Safe Slicing)
    // We do this AFTER pushing usually, but here we can check before
    // Actually, simpler to push first then slice newest 3
    // But to match current structure:
    if (user.refreshTokens.length >= 3) {
      // Sort by createdAt ascending (oldest first) so we can remove the oldest
      user.refreshTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Remove oldest until we have 2 (so we can add 1 more to make 3)
      while (user.refreshTokens.length >= 3) {
        user.refreshTokens.shift();
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

    // Save with retry logic to handle concurrent login attempts (VersionError)
    const MAX_RETRIES = 3;
    let attempts = 0;
    let saved = false;

    while (attempts < MAX_RETRIES && !saved) {
      try {
        await user.save();
        saved = true;
      } catch (err) {
        if (err.name === 'VersionError' && attempts < MAX_RETRIES - 1) {
          attempts++;
          console.warn(`⚠️  Login VersionError for ${email} (attempt ${attempts}/${MAX_RETRIES}), retrying...`);
          // Exponential backoff: 50ms, 100ms, 150ms
          await new Promise(resolve => setTimeout(resolve, 50 * attempts));

          // Reload user document to get latest version
          const freshUser = await User.findById(user._id);
          if (!freshUser) {
            throw new Error('User document not found during retry');
          }

          // Re-apply changes to fresh document
          freshUser.refreshTokens = user.refreshTokens;
          freshUser.lastLoginAt = user.lastLoginAt;
          freshUser.isOnline = user.isOnline;
          user = freshUser;

          continue;
        }
        // Non-version error or max retries exhausted
        throw err;
      }
    }

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
        companyId: user.companyId ? user.companyId._id : null, // Add companyId for redirect logic
        companyRole: user.companyRole,
        profilePicture: user.profilePicture,
        userStatus: user.userStatus,
        preferences: user.preferences,
        emails: user.emails ? user.emails.map(e => ({
          id: e._id,
          email: e.email,
          verified: e.verified,
          isPrimary: e.isPrimary,
          addedAt: e.addedAt
        })) : []
      }
    };

    // --- REDIRECT LOGIC ---

    // 1. Super Admin
    if (user.roles.includes('chttrix_admin')) {
      response.redirectTo = "/chttrix-admin";
    }
    // 2. Company User
    else if (user.companyId) { // user.companyId is populated
      response.company = {
        id: user.companyId._id,
        name: user.companyId.name,
        domain: user.companyId.domain,
        defaultWorkspace: user.companyId.defaultWorkspace,
        isSetupComplete: user.companyId.isSetupComplete, // Setup Flag
        setupStep: user.companyId.setupStep // Setup Step
      };

      // Check if user is admin/owner
      const isAdmin = user.companyRole === "owner" || user.companyRole === "admin";
      response.isAdmin = isAdmin;

      // Logic for Setup Flow
      if (!user.companyId.isSetupComplete) {
        // Not setup yet -> Go to Confirmation (or Resume Setup)
        response.redirectTo = "/company/confirm";
      } else {
        // Normal Flow
        if (isAdmin) {
          response.redirectTo = "/admin/dashboard"; // Admin dashboard
        } else {
          response.redirectTo = "/workspaces"; // Regular workspace view
        }
      }
    } else {
      // 3. Personal User
      response.redirectTo = "/workspaces";
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
  const MAX_RETRIES = 3;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const refreshToken = req.cookies?.jwt;
      if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

      const refreshHash = sha256(refreshToken);

      const user = await User.findOne({
        "refreshTokens.tokenHash": refreshHash
      });

      if (!user) return res.status(403).json({ message: "Invalid refresh token" });

      // Verify JWT signature
      try {
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch (err) {
        return res.status(403).json({ message: "Invalid refresh token signature" });
      }

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
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: REFRESH_DAYS * 86400000
      });

      return res.json({ accessToken: newAccess });

    } catch (err) {
      if (err.name === 'VersionError' && attempts < MAX_RETRIES - 1) {
        console.warn(`Refresh token VersionError (attempt ${attempts + 1}/${MAX_RETRIES}), retrying...`);
        attempts++;
        // Small delay to reduce contention
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      console.error("REFRESH ERROR:", err);
      // Only return 500 if we exhausted retries or hit another error
      return res.status(500).json({ message: "Server error" });
    }
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

      return res.json({ message: "If that email exists, reset link sent" });
    }

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = sha256(raw);

    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const url = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;

    // Send reset email (or log to console in development)
    try {
      await sendEmail({
        to: email,
        subject: "Password Reset",
        html: `Reset your password: <a href="${url}">${url}</a>`
      });
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
      // If SMTP not configured, log the link to console (for development)
      console.log("\n" + "=".repeat(80));
      console.log("🔐 PASSWORD RESET LINK (SMTP not configured)");
      console.log("=".repeat(80));
      console.log(`User: ${email}`);
      console.log(`Reset Link: ${url}`);
      console.log("=".repeat(80) + "\n");
    }

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
    const user = await User.findById(req.user.sub)
      .select("-passwordHash -refreshTokens")
      .populate('companyId');

    // Migration: Ensure primary email is in emails array
    if (!user.emails || user.emails.length === 0) {
      user.emails = [{
        email: user.email,
        verified: true, // Assume existing emails are verified
        isPrimary: true,
        addedAt: user.createdAt || new Date()
      }];
      await user.save();
    } else {
      // Check if primary email exists in array
      const primaryExists = user.emails.some(e => e.isPrimary);
      if (!primaryExists) {
        // Find if main email is in array
        const mainEmailEntry = user.emails.find(e => e.email === user.email);
        if (mainEmailEntry) {
          mainEmailEntry.isPrimary = true;
          await user.save();
        } else {
          // Add main email as primary
          user.emails.unshift({
            email: user.email,
            verified: true,
            isPrimary: true,
            addedAt: user.createdAt || new Date()
          });
          await user.save();
        }
      }
    }

    // Convert user to plain object and map emails with id field
    const userObject = user.toObject();

    // Normalize company data
    if (userObject.companyId && typeof userObject.companyId === 'object') {
      userObject.company = {
        id: userObject.companyId._id,
        name: userObject.companyId.name,
        domain: userObject.companyId.domain,
        defaultWorkspace: userObject.companyId.defaultWorkspace,
        isSetupComplete: userObject.companyId.isSetupComplete,
        setupStep: userObject.companyId.setupStep
      };
      // Keep companyId as ID string for consistency with some checks if needed, 
      // or just leave it as object. 
      // For now, let's keep it consistent with Login which seems to return ID string in user.companyId
      // But populate() replaced it. 
      // Let's just rely on user.company for the rich data.
    }

    if (userObject.emails) {
      userObject.emails = userObject.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }));
    }

    // Migration: Handle legacy phone format (combined phone+code in phone field)
    if (userObject.phone && userObject.phone.startsWith('+')) {
      // Phone is in old format: "+919381870544"
      // Parse it to split into phoneCode and phone
      const phoneMatch = userObject.phone.match(/^(\+\d{1,3})(\d+)$/);

      if (phoneMatch) {
        const extractedCode = phoneMatch[1]; // e.g., "+91"
        const extractedPhone = phoneMatch[2]; // e.g., "9381870544"

        // Update user in database with split format
        user.phoneCode = extractedCode;
        user.phone = extractedPhone;
        await user.save();

        // Update the response object
        userObject.phoneCode = extractedCode;
        userObject.phone = extractedPhone;

        console.log(`📞 Migrated phone for user ${user.email}: ${extractedCode} ${extractedPhone}`);
      }
    } else if (userObject.phone && /^\d{11,13}$/.test(userObject.phone)) {
      // Phone is stored as plain number without + (e.g., "918989898989")
      // Try to detect country code from the number itself
      let extractedCode = "+1"; // Default
      let extractedPhone = userObject.phone;

      // Check for common country code patterns
      if (userObject.phone.startsWith('91') && userObject.phone.length === 12) {
        // Indian number: 91 + 10 digits
        extractedCode = "+91";
        extractedPhone = userObject.phone.substring(2);
      } else if (userObject.phone.startsWith('44') && userObject.phone.length === 12) {
        // UK number: 44 + 10 digits
        extractedCode = "+44";
        extractedPhone = userObject.phone.substring(2);
      } else if (userObject.phone.startsWith('1') && userObject.phone.length === 11) {
        // US/Canada number: 1 + 10 digits
        extractedCode = "+1";
        extractedPhone = userObject.phone.substring(1);
      }

      // Update user in database
      user.phoneCode = extractedCode;
      user.phone = extractedPhone;
      await user.save();

      // Update response object
      userObject.phoneCode = extractedCode;
      userObject.phone = extractedPhone;

      console.log(`📞 Migrated phone (no prefix) for user ${user.email}: ${extractedCode} ${extractedPhone}`);
    }

    return res.json(userObject);
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

    // Basic Info Updates
    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.phoneCode !== undefined) user.phoneCode = req.body.phoneCode;

    // Profile Updates
    if (!user.profile) user.profile = {};

    // Date of Birth validation - only update if a valid non-empty value is provided
    if (req.body.dob !== undefined && req.body.dob !== "") {
      const dob = new Date(req.body.dob);
      const today = new Date();

      // Check if date is valid
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ message: "Invalid date of birth" });
      }

      const age = today.getFullYear() - dob.getFullYear();

      if (dob > today) {
        return res.status(400).json({ message: "Date of birth cannot be in the future" });
      }
      if (age < 13) {
        return res.status(400).json({ message: "You must be at least 13 years old" });
      }

      user.profile.dob = dob;
    }

    // About field with character limit - only update if provided
    if (req.body.about !== undefined && req.body.about !== "") {
      const about = req.body.about.trim();
      if (about.length > 500) {
        return res.status(400).json({ message: "About section must be 500 characters or less" });
      }
      user.profile.about = about;
    }

    if (req.body.company !== undefined) user.profile.company = req.body.company;
    if (req.body.showCompany !== undefined) user.profile.showCompany = req.body.showCompany;

    // Preference Updates
    if (!user.preferences) user.preferences = {};
    if (req.body.preferences) {
      if (req.body.preferences.theme) user.preferences.theme = req.body.preferences.theme;
    }

    // Check for duplicate phone number before saving (if phone is being updated)
    if (req.body.phone !== undefined && req.body.phone) {
      const existingUser = await User.findOne({
        phone: req.body.phone,
        _id: { $ne: user._id } // Exclude current user
      });

      if (existingUser) {
        return res.status(409).json({ message: "Phone number already in use by another account" });
      }
    }

    await user.save();

    return res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        phoneCode: user.phoneCode,
        dob: user.profile?.dob || "",
        about: user.profile?.about || "",
        company: user.profile?.company || "",
        showCompany: user.profile?.showCompany ?? true,
        verified: user.verified,
        roles: user.roles,
        userStatus: user.userStatus,
        preferences: user.preferences
      }
    });

  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    console.error("Error details:", {
      name: err.name,
      code: err.code,
      message: err.message
    });

    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      return res.status(409).json({
        message: `That ${field} is already in use by another account`
      });
    }

    return res.status(500).json({ message: err.message || "Server error" });
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    // DEDUPLICATION & CLEANUP:
    // Remove duplicate tokens (same hash) to prevent "double current" bugs
    // ---------------------------------------------------------

    const seenHashes = new Set();
    const uniqueTokens = [];
    let isDirty = false;

    // Process from newest to oldest (if we assume array is roughly ordered)
    // or just iterate and keep first.
    // Let's iterate normally.
    for (const t of user.refreshTokens) {
      if (seenHashes.has(t.tokenHash)) {

        isDirty = true; // Found a duplicate, will need to save
        continue;
      }
      seenHashes.add(t.tokenHash);
      uniqueTokens.push(t);
    }

    if (isDirty) {

      user.refreshTokens = uniqueTokens;
      user.markModified('refreshTokens'); // Explicitly mark as modified
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

    // Keep ONLY the current session (Strict: Find first match and discard EVERYTHING else)
    const activeToken = user.refreshTokens.find(t => t.tokenHash === currentHash);

    if (activeToken) {
      user.refreshTokens = [activeToken]; // Reset array to just this one
    } else {
      // Should be impossible if logged in, but safe fallback
      user.refreshTokens = [];
    }

    user.markModified('refreshTokens');
    await user.save();

    res.json({ message: "All other sessions revoked" });
  } catch (err) {
    console.error("REVOKE OTHERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------
// EMAIL MANAGEMENT
// ----------------------------------------------------
const { generateVerificationCode, emailVerificationTemplate } = require("../utils/emailTemplates");

// Add new email
exports.addEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.sub;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findById(userId);

    // Check if user already has 5 emails
    if (user.emails && user.emails.length >= 5) {
      return res.status(400).json({ message: "Maximum 5 email addresses allowed" });
    }

    // Check if email already exists for this user
    if (user.emails && user.emails.some(e => e.email === normalizedEmail)) {
      return res.status(400).json({ message: "Email already added to your account" });
    }

    // Check if email exists for any other user (in email field or emails array)
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { "emails.email": normalizedEmail }
      ]
    });

    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const tokenHash = sha256(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Add email to array
    if (!user.emails) user.emails = [];

    user.emails.push({
      email: normalizedEmail,
      verified: false,
      isPrimary: false,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: expiresAt
    });

    await user.save();

    // Send verification email
    let devCode = null;
    // Development Log (Always show code in console)
    console.log("\n" + "=".repeat(80));
    console.log(`📧 VERIFICATION CODE: ${code}`);
    console.log("=".repeat(80) + "\n");

    try {
      const template = emailVerificationTemplate(user.username, code);
      await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);

      // Development mode: Always log code when email fails (SMTP not configured)
      console.log("\n" + "=".repeat(80));
      console.log(`📧 EMAIL VERIFICATION CODE (SMTP not configured)`);
      console.log("=".repeat(80));
      console.log(`Code: ${code}`);
      console.log("=".repeat(80) + "\n");

      devCode = code;
    }

    const response = {
      message: devCode
        ? `Email added. Verification code: ${devCode} (Check console in production)`
        : "Email added. Please check your inbox for verification code.",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    };

    res.json(response);

  } catch (err) {
    console.error("ADD EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify email with code
exports.verifyEmailCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const userId = req.user.sub;

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const user = await User.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Check if code matches
    const codeHash = sha256(code);
    if (emailEntry.verificationTokenHash !== codeHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Check if code expired
    if (new Date() > emailEntry.verificationTokenExpires) {
      return res.status(400).json({ message: "Verification code expired. Please request a new one." });
    }

    // Mark as verified
    emailEntry.verified = true;
    emailEntry.verificationTokenHash = undefined;
    emailEntry.verificationTokenExpires = undefined;

    await user.save();

    res.json({
      message: "Email verified successfully",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend verification code
exports.resendVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new code
    const code = generateVerificationCode();
    const tokenHash = sha256(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    emailEntry.verificationTokenHash = tokenHash;
    emailEntry.verificationTokenExpires = expiresAt;

    await user.save();

    // Development Log (Always show code in console)
    console.log("\n" + "=".repeat(80));
    console.log(`📧 VERIFICATION CODE: ${code}`);
    console.log("=".repeat(80) + "\n");

    // Send verification email
    try {
      const template = emailVerificationTemplate(user.username, code);
      await sendEmail({
        to: emailEntry.email,
        subject: template.subject,
        text: template.text,
        html: template.html
      });

      res.json({ message: "Verification code sent. Please check your inbox." });
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);

      // Development mode: Always log code when email fails
      console.log("\n" + "=".repeat(80));
      console.log(`📧 EMAIL VERIFICATION CODE (SMTP not configured)`);
      console.log("=".repeat(80));
      console.log(`Code: ${code}`);
      console.log("=".repeat(80) + "\n");

      res.json({ message: `Verification code: ${code} (Check server console)` });
    }

  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Set email as primary
exports.setPrimaryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (!emailEntry.verified) {
      return res.status(400).json({ message: "Cannot set unverified email as primary" });
    }

    // Set all emails to not primary
    user.emails.forEach(e => {
      e.isPrimary = false;
    });

    // Set target email as primary
    emailEntry.isPrimary = true;

    // Update main email field
    user.email = emailEntry.email;

    await user.save();

    res.json({
      message: "Primary email updated",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (err) {
    console.error("SET PRIMARY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete email
exports.deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.isPrimary) {
      return res.status(400).json({ message: "Cannot delete primary email. Set another email as primary first." });
    }

    // Check if this is the only verified email (excluding primary)
    const verifiedEmails = user.emails.filter(e => e.verified);
    if (verifiedEmails.length === 1 && emailEntry.verified) {
      return res.status(400).json({ message: "Cannot delete your only verified email" });
    }

    // Remove email
    user.emails.pull(id);
    await user.save();

    res.json({
      message: "Email deleted",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (err) {
    console.error("DELETE EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
