// server/controllers/companyController.js
const Company = require("../models/Company");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { createInvite, verifyInvite, sha256 } = require("../utils/invite");
const { generateToken, checkDomainForToken } = require("../utils/domainVerify");
const sendEmail = require("../utils/sendEmail");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateTokens");



exports.createCompany = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { name, domain } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    // 1. Create Company
    const company = await Company.create({
      name,
      domain,
      plan: "free",
    });

    // 2. Assign user to this company as ADMIN
    const user = await User.findById(userId);
    user.companyId = company._id;

    if (!user.rolesPerCompany) user.rolesPerCompany = {};
    user.rolesPerCompany[company._id] = "admin";

    await user.save();

    return res.status(201).json({ company });
  } catch (err) {
    console.error("CREATE COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




/**
 * Helper: ensure requester is admin/owner of the company
 */
async function ensureCompanyAdmin(userId, companyId) {
  if (!userId) return false;
  const user = await User.findById(userId).lean();
  if (!user) return false;
  if (!user.companyId) return false;
  if (String(user.companyId) !== String(companyId)) return false;
  const role = user.rolesPerCompany ? user.rolesPerCompany[companyId] : null;
  if (!role) return false;
  return (role === "admin" || role === "owner");
}



exports.getCompanyMembers = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const requesterId = req.user?.sub;

    const allowed = await ensureCompanyAdmin(requesterId, companyId);
    if (!allowed) return res.status(403).json({ message: "Not allowed" });

    const members = await User.find({ companyId })
      .select("username email rolesPerCompany profilePicture createdAt")
      .lean();

    const membersWithRole = members.map(m => ({
      _id: m._id,
      username: m.username,
      email: m.email,
      profilePicture: m.profilePicture,
      createdAt: m.createdAt,
      role: m.rolesPerCompany ? m.rolesPerCompany[companyId] : "member"
    }));

    return res.json({ members: membersWithRole });
  } catch (err) {
    console.error("GET MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.inviteToCompany = async (req, res) => {
  try {
    const inviterId = req.user?.sub;
    const companyId = req.params.companyId;
    const { email, workspaceId = null, role = "member", daysValid = 7 } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    // permission: inviter must be company member/admin
    const inviter = await User.findById(inviterId);
    if (!inviter || String(inviter.companyId) !== String(companyId)) {
      return res.status(403).json({ message: "Only company members can invite" });
    }
    const inviterRole = inviter.rolesPerCompany ? inviter.rolesPerCompany[companyId] : null;
    if (!inviterRole || (inviterRole !== "admin" && inviterRole !== "owner")) {
      return res.status(403).json({ message: "Only company admins can invite" });
    }

    const { rawToken, invite } = await createInvite({
      email,
      companyId,
      workspaceId,
      role,
      invitedBy: inviterId,
      daysValid
    });

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // optional email
    try {
      await sendEmail({
        to: email,
        subject: `Invite to join ${inviter.companyId ? inviter.companyId : "your company"}`,
        html: `You were invited to join a company. Accept: <a href="${inviteLink}">${inviteLink}</a>`
      });
    } catch (e) {
      console.warn("Failed sending invite email:", e?.message || e);
    }

    return res.json({ message: "Invite created", inviteId: invite._id, inviteLink });
  } catch (err) {
    console.error("INVITE TO COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.acceptInvite = async (req, res) => {
  try {
    const { token, username, password } = req.body;
    if (!token || !username || !password) return res.status(400).json({ message: "token, username and password required" });

    const invite = await verifyInvite(token);
    if (!invite) return res.status(400).json({ message: "Invalid or expired invite" });

    let user = await User.findOne({ email: invite.email });

    if (!user) {
      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);

      user = await User.create({
        username,
        email: invite.email,
        passwordHash,
        verified: true,
        companyId: invite.company,
        rolesPerCompany: { [invite.company]: invite.role }
      });
    } else {
      // Single-company-per-user policy: if user already has companyId set and it's different, reject.
      if (user.companyId && String(user.companyId) !== String(invite.company)) {
        return res.status(400).json({ message: "This account already belongs to another company" });
      }

      user.companyId = invite.company;
      user.rolesPerCompany = user.rolesPerCompany || {};
      user.rolesPerCompany[invite.company] = invite.role;
      await user.save();
    }

    // Add to workspace members if workspace provided
    if (invite.workspace) {
      const ws = await Workspace.findById(invite.workspace);
      if (ws) {
        const exists = ws.members?.some(m => String(m.user) === String(user._id));
        if (!exists) {
          ws.members.push({ user: user._id, role: invite.role || "member" });
          await ws.save();
        }
      }
    }

    invite.used = true;
    await invite.save();

    // Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // store refresh token hash like authController.login
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + (process.env.REFRESH_TOKEN_DAYS ? parseInt(process.env.REFRESH_TOKEN_DAYS) * 86400000 : 7 * 86400000)),
      deviceInfo: req.get("User-Agent") || "invite-flow"
    });
    await user.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: (process.env.REFRESH_TOKEN_DAYS ? parseInt(process.env.REFRESH_TOKEN_DAYS) : 7) * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: "Invite accepted",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        companyId: user.companyId
      }
    });
  } catch (err) {
    console.error("ACCEPT INVITE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.checkDomain = async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ message: "Domain required" });

    const company = await Company.findOne({ domain }).select("name domain logo domainVerified");
    if (!company) return res.status(404).json({ message: "No company found for this domain" });

    return res.json({ company });
  } catch (err) {
    console.error("CHECK DOMAIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/companies/:id/domain/generate
 * Generates verification token and stores in Company.domainVerificationToken.
 * Returns token and TXT record instruction.
 */
exports.generateDomainToken = async (req, res) => {
  try {
    const companyId = req.params.id;
    const requesterId = req.user?.sub;

    const allowed = await ensureCompanyAdmin(requesterId, companyId);
    if (!allowed) return res.status(403).json({ message: "Not allowed" });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!company.domain) return res.status(400).json({ message: "Company domain is not set" });

    // Generate token and expiry (24 hours)
    const token = generateToken();
    company.domainVerificationToken = token;
    company.domainVerificationExpires = new Date(Date.now() + 24 * 3600 * 1000);
    company.domainVerified = false;
    await company.save();

    // Provide instructions: either TXT record at root or at _chttrix subdomain
    const txtRoot = `${token}`;
    const txtSub = `_chttrix.${company.domain} TXT "${token}"`;

    return res.json({
      message: "Domain verification token generated",
      token,
      expiresAt: company.domainVerificationExpires,
      instructions: [
        `Create a DNS TXT record for domain ${company.domain} with the value: ${txtRoot}`,
        `OR create a TXT record for _chttrix.${company.domain}: ${txtSub}`
      ],
      checkUrl: `/api/companies/${companyId}/domain/check`
    });
  } catch (err) {
    console.error("GEN DOMAIN TOKEN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/companies/:id/domain/check
 * Checks DNS TXT records for presence of token and if found marks company.domainVerified = true
 */
exports.checkDomainVerification = async (req, res) => {
  try {
    const companyId = req.params.id;
    const requesterId = req.user?.sub;

    // requester must be company admin OR global admin (we treat company admin only here)
    const allowed = await ensureCompanyAdmin(requesterId, companyId);
    if (!allowed) return res.status(403).json({ message: "Not allowed" });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (!company.domainVerificationToken || !company.domainVerificationExpires) {
      return res.status(400).json({ message: "No verification token generated" });
    }

    if (company.domainVerificationExpires < new Date()) {
      return res.status(400).json({ message: "Verification token expired — regenerate" });
    }

    // check DNS
    let found = false;
    try {
      found = await checkDomainForToken(company.domain, company.domainVerificationToken);
    } catch (err) {
      console.warn("DNS check error:", err?.message || err);
      return res.status(500).json({ message: "DNS lookup failed" });
    }

    if (!found) {
      return res.status(400).json({ message: "Token not found in DNS records" });
    }

    // Mark verified
    company.domainVerified = true;
    // optional: clear token & expiry
    company.domainVerificationToken = null;
    company.domainVerificationExpires = null;
    await company.save();

    return res.json({ message: "Domain verified", domainVerified: true });
  } catch (err) {
    console.error("CHECK DOMAIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/companies/:id/domain/clear
 * Clears verification fields (admin only).
 */
exports.clearDomainVerification = async (req, res) => {
  try {
    const companyId = req.params.id;
    const requesterId = req.user?.sub;

    const allowed = await ensureCompanyAdmin(requesterId, companyId);
    if (!allowed) return res.status(403).json({ message: "Not allowed" });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.domainVerificationToken = null;
    company.domainVerificationExpires = null;
    company.domainVerified = false;
    await company.save();

    return res.json({ message: "Domain verification cleared" });
  } catch (err) {
    console.error("CLEAR DOMAIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Public endpoint to create a company (e.g. during onboarding/signup).
 * Does NOT assign a user owner automatically (unless userId is passed, but typically this is for pre-auth).
 */
exports.createInitialCompany = async (req, res) => {
  try {
    const userId = req.user?.sub; // FIXED

    const { name, domain } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });

    const company = await Company.create({
      name,
      domain: domain?.toLowerCase(),
      domainVerified: false,
      allowedEmails: [],
      invitePolicy: { requireInvite: false, allowExternalInvite: false }
    });

    // Assign logged-in user as owner
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.companyId = company._id;
        user.rolesPerCompany = { [company._id]: "owner" };
        await user.save();
      }
    }

    return res.json({
      message: "Company created successfully",
      company
    });
  } catch (err) {
    console.error("CREATE INITIAL COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
