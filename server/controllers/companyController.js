// server/controllers/companyController.js

const Company = require("../models/Company");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Invite = require("../models/Invite");
const { logAction } = require("../utils/historyLogger");
const {
  generateDomainVerificationToken,
  verifyDomainTXT,
  extractDomain,
  emailMatchesDomain,
  isValidDomain
} = require("../utils/domainVerification");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

// ============================================================================
// COMPANY REGISTRATION
// ============================================================================

/**
 * Create a new company with admin user and default workspace/channels
 * POST /api/companies/register
 */
exports.registerCompany = async (req, res) => {
  try {
    const {
      companyName,
      adminName,
      adminEmail,
      adminPassword, // NEW: Accept password during registration
      domain,
      documents,
      skipDomainVerification = true // Make domain verification optional
    } = req.body;

    // Validation
    if (!companyName || !adminName || !adminEmail) {
      return res.status(400).json({
        message: "Company name, admin name, and admin email are required"
      });
    }

    if (!adminPassword) {
      return res.status(400).json({
        message: "Admin password is required"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "Admin email already in use"
      });
    }

    // Validate domain if provided (but don't require verification)
    if (domain && !isValidDomain(domain)) {
      return res.status(400).json({ message: "Invalid domain format" });
    }

    // Check if domain already claimed
    if (domain) {
      const existingCompany = await Company.findOne({ domain });
      if (existingCompany) {
        return res.status(409).json({ message: "Domain already registered" });
      }
    }

    // Step 1: Create Company
    const company = new Company({
      name: companyName,
      domain: domain ? domain.toLowerCase() : null,
      domainVerified: false, // Can verify later (optional)
      documents: documents || [],
      billingEmail: adminEmail
    });

    await company.save();

    console.log(`✅ Company created: ${companyName} (ID: ${company._id})`);

    // Step 2: Create Admin User with provided password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = new User({
      username: adminName,
      email: adminEmail,
      passwordHash,
      userType: "company",
      companyId: company._id,
      companyRole: "owner",
      verified: true // Auto-verify admin
    });

    await adminUser.save();

    console.log(`✅ Admin user created: ${adminName} (${adminEmail})`);

    // Step 3: Add admin to company.admins array
    company.admins.push({
      user: adminUser._id,
      role: "owner"
    });

    // Step 4: Create Default Workspace
    const defaultWorkspace = new Workspace({
      company: company._id,
      type: "company",
      name: `${companyName} Workspace`,
      description: "Default company workspace",
      createdBy: adminUser._id,
      members: [{
        user: adminUser._id,
        role: "owner"
      }]
    });

    await defaultWorkspace.save();

    console.log(`✅ Default workspace created: ${defaultWorkspace.name}`);

    // Update company with default workspace
    company.defaultWorkspace = defaultWorkspace._id;
    await company.save();

    // Update user's workspace memberships
    adminUser.workspaces.push({
      workspace: defaultWorkspace._id,
      role: "owner"
    });
    await adminUser.save();

    // Step 5: Create Default Channels (#general, #announcements)
    const generalChannel = new Channel({
      workspace: defaultWorkspace._id,
      company: company._id,
      name: "general",
      description: "General discussion",
      isPrivate: false,
      isDefault: true,
      createdBy: adminUser._id,
      members: [adminUser._id]
    });

    const announcementsChannel = new Channel({
      workspace: defaultWorkspace._id,
      company: company._id,
      name: "announcements",
      description: "Company announcements",
      isPrivate: false,
      isDefault: true,
      createdBy: adminUser._id,
      members: [adminUser._id]
    });

    await generalChannel.save();
    await announcementsChannel.save();

    console.log(`✅ Default channels created: #general, #announcements`);

    // Update workspace with default channels
    defaultWorkspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
    await defaultWorkspace.save();

    // Log the company creation
    await logAction({
      userId: adminUser._id,
      action: "company_created",
      description: `Company "${companyName}" registered`,
      resourceType: "company",
      resourceId: company._id,
      companyId: company._id,
      metadata: { companyName, domain },
      req
    });

    console.log("\n" + "=".repeat(80));
    console.log("🏢 COMPANY REGISTRATION SUCCESSFUL");
    console.log("Company:", companyName);
    console.log("Admin:", adminName);
    console.log("Email:", adminEmail);
    console.log("Company ID:", company._id);
    console.log("Workspace ID:", defaultWorkspace._id);
    console.log("=".repeat(80) + "\n");

    return res.status(201).json({
      message: "Company registered successfully. Please login to access your dashboard.",
      redirectTo: "/login", // REDIRECT TO LOGIN
      company: {
        id: company._id,
        name: company.name,
        domain: company.domain,
        defaultWorkspace: defaultWorkspace._id
      },
      admin: {
        id: adminUser._id,
        name: adminUser.username,
        email: adminUser.email,
        role: "owner"
      },
      workspace: {
        id: defaultWorkspace._id,
        name: defaultWorkspace.name
      },
      // For domain verification later
      domainVerificationAvailable: !!domain,
      canVerifyDomainLater: true
    });


  } catch (err) {
    console.error("REGISTER COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// DOMAIN VERIFICATION
// ============================================================================

/**
 * Generate domain verification token
 * POST /api/companies/:id/domain/generate
 */
exports.generateDomainVerification = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if user is company admin
    if (!company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only company admins can verify domain" });
    }

    if (!company.domain) {
      return res.status(400).json({ message: "Company domain not set" });
    }

    // Generate verification token
    const { token, txtRecord } = generateDomainVerificationToken();

    company.domainVerificationToken = token;
    company.domainVerificationExpires = new Date(Date.now() + 86400000); // 24 hours
    company.domainVerified = false;
    await company.save();

    console.log(`🔐 Domain verification token generated for ${company.domain}`);

    return res.json({
      message: "Domain verification token generated",
      domain: company.domain,
      txtRecord,
      expiresAt: company.domainVerificationExpires,
      instructions: [
        `Add the following TXT record to your DNS settings for ${company.domain}: `,
        `Record Type: TXT`,
        `Host / Name: @(or leave blank for root domain)`,
        `Value: ${txtRecord} `,
        ``,
        `After adding the DNS record, wait a few minutes for DNS propagation, then click "Verify Domain" to complete verification.`
      ]
    });

  } catch (err) {
    console.error("GENERATE DOMAIN VERIFICATION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Verify domain via DNS TXT record check
 * POST /api/companies/:id/domain/verify
 */
exports.verifyDomain = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only company admins can verify domain" });
    }

    if (!company.domainVerificationToken || !company.domainVerificationExpires) {
      return res.status(400).json({
        message: "No verification token generated. Please generate one first."
      });
    }

    if (company.domainVerificationExpires < new Date()) {
      return res.status(400).json({
        message: "Verification token expired. Please generate a new one."
      });
    }

    // Verify DNS TXT record
    const verified = await verifyDomainTXT(company.domain, company.domainVerificationToken);

    if (!verified) {
      return res.status(400).json({
        message: "Domain verification failed. TXT record not found or incorrect."
      });
    }

    // Mark as verified
    company.domainVerified = true;
    company.domainVerificationToken = null;
    company.domainVerificationExpires = null;
    await company.save();

    // Log verification
    await logAction({
      userId,
      action: "domain_verified",
      description: `Domain ${company.domain} verified`,
      resourceType: "company",
      resourceId: company._id,
      companyId: company._id,
      req
    });

    console.log(`✅ Domain verified: ${company.domain} `);

    return res.json({
      message: "Domain verified successfully",
      domain: company.domain,
      verified: true
    });

  } catch (err) {
    console.error("VERIFY DOMAIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Enable/disable auto-join by domain
 * PUT /api/companies/:id/domain/auto-join
 */
exports.setAutoJoinPolicy = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const { autoJoinByDomain } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.isOwner(userId)) {
      return res.status(403).json({ message: "Only company owners can change auto-join policy" });
    }

    if (!company.domainVerified) {
      return res.status(400).json({
        message: "Domain must be verified before enabling auto-join"
      });
    }

    company.autoJoinByDomain = autoJoinByDomain === true;
    await company.save();

    console.log(`🔄 Auto - join policy ${company.autoJoinByDomain ? 'enabled' : 'disabled'} for ${company.domain}`);

    return res.json({
      message: "Auto-join policy updated",
      autoJoinByDomain: company.autoJoinByDomain
    });

  } catch (err) {
    console.error("SET AUTO-JOIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// EMPLOYEE ONBOARDING
// ============================================================================

/**
 * Invite single user to company
 * POST /api/companies/:id/invite
 */
exports.inviteEmployee = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const { email, role = "member", workspaceId = null } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check permissions
    if (!company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only company admins can invite employees" });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.companyId) {
      if (existingUser.companyId.toString() === companyId) {
        return res.status(400).json({ message: "User already belongs to this company" });
      } else {
        return res.status(400).json({ message: "User already belongs to another company" });
      }
    }

    // Create invite
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    const invite = new Invite({
      email: email.toLowerCase(),
      tokenHash,
      company: companyId,
      workspace: workspaceId,
      role,
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 86400000) // 7 days
    });

    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

    console.log(`📧 Invite created for ${email}`);
    console.log(`   Link: ${inviteLink}`);

    // Send email
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to join ${company.name} on Chttrix`,
        html: `
          <h2>You've been invited!</h2>
          <p>You've been invited to join ${company.name} on Chttrix.</p>
          <p><a href="${inviteLink}">Accept Invitation</a></p>
          <p>This invitation expires in 7 days.</p>
        `
      });
    } catch (emailErr) {
      console.warn("Failed to send invite email:", emailErr.message);
    }

    // Log invitation
    await logAction({
      userId,
      action: "user_invited",
      description: `Invited ${email} to company`,
      resourceType: "invite",
      resourceId: invite._id,
      companyId,
      metadata: { email, role },
      req
    });

    return res.json({
      message: "Invitation sent successfully",
      inviteId: invite._id,
      inviteLink // for testing
    });

  } catch (err) {
    console.error("INVITE EMPLOYEE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Bulk invite employees via CSV
 * POST /api/companies/:id/invite/bulk
 * Body: { employees: [{ name, email, department, role }] }
 */
exports.bulkInviteEmployees = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ message: "Employees array is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only company admins can invite employees" });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const emp of employees) {
      try {
        const { name, email, role = "member" } = emp;

        if (!email || !name) {
          results.failed.push({ email, error: "Missing name or email" });
          continue;
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser && existingUser.companyId) {
          results.failed.push({ email, error: "User already has a company" });
          continue;
        }

        // Create invite
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(rawToken);

        const invite = new Invite({
          email: email.toLowerCase(),
          tokenHash,
          company: companyId,
          workspace: company.defaultWorkspace,
          role,
          invitedBy: userId,
          expiresAt: new Date(Date.now() + 7 * 86400000)
        });

        await invite.save();

        const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

        // Send email
        try {
          await sendEmail({
            to: email,
            subject: `You're invited to join ${company.name} on Chttrix`,
            html: `
              <h2>Welcome ${name}!</h2>
              <p>You've been invited to join ${company.name} on Chttrix.</p>
              <p><a href="${inviteLink}">Accept Invitation</a></p>
            `
          });
        } catch (emailErr) {
          console.warn(`Failed to send email to ${email}:`, emailErr.message);
        }

        results.success.push({ name, email, inviteId: invite._id });

      } catch (err) {
        results.failed.push({ email: emp.email, error: err.message });
      }
    }

    console.log(`✅ Bulk invite completed: ${results.success.length} sent, ${results.failed.length} failed`);

    return res.json({
      message: "Bulk invitation completed",
      summary: {
        total: employees.length,
        success: results.success.length,
        failed: results.failed.length
      },
      results
    });

  } catch (err) {
    console.error("BULK INVITE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Accept company invitation
 * POST /api/companies/accept-invite
 */
exports.acceptInvite = async (req, res) => {
  try {
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
      return res.status(400).json({
        message: "Token, username, and password are required"
      });
    }

    // Find invite
    const tokenHash = sha256(token);
    const invite = await Invite.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate("company");

    if (!invite) {
      return res.status(400).json({
        message: "Invalid or expired invitation"
      });
    }

    const company = invite.company;

    // Check if user already exists
    let user = await User.findOne({ email: invite.email });

    if (user) {
      // User exists - attach to company
      if (user.companyId && user.companyId.toString() !== company._id.toString()) {
        return res.status(400).json({
          message: "You already belong to another company"
        });
      }

      user.companyId = company._id;
      user.userType = "company";
      user.companyRole = invite.role;

    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(password, 12);

      user = new User({
        username,
        email: invite.email,
        passwordHash,
        userType: "company",
        companyId: company._id,
        companyRole: invite.role,
        verified: true
      });
    }

    await user.save();

    // Add to workspace if specified
    if (invite.workspace) {
      const workspace = await Workspace.findById(invite.workspace);
      if (workspace && !workspace.isMember(user._id)) {
        workspace.members.push({
          user: user._id,
          role: "member"
        });
        await workspace.save();

        user.workspaces.push({
          workspace: workspace._id,
          role: "member"
        });

        // Add to default channels
        const defaultChannels = await Channel.find({
          workspace: workspace._id,
          isDefault: true
        });

        for (const channel of defaultChannels) {
          if (!channel.members.includes(user._id)) {
            channel.members.push(user._id);
            await channel.save();
          }
        }
      }
    } else if (company.defaultWorkspace) {
      // Add to company default workspace
      const workspace = await Workspace.findById(company.defaultWorkspace);
      if (workspace && !workspace.isMember(user._id)) {
        workspace.members.push({
          user: user._id,
          role: "member"
        });
        await workspace.save();

        user.workspaces.push({
          workspace: workspace._id,
          role: "member"
        });

        // Add to default channels
        const defaultChannels = await Channel.find({
          workspace: workspace._id,
          isDefault: true
        });

        for (const channel of defaultChannels) {
          if (!channel.members.includes(user._id)) {
            channel.members.push(user._id);
            await channel.save();
          }
        }
      }
    }

    await user.save();

    // Mark invite as used
    invite.used = true;
    await invite.save();

    // Log user joining
    await logAction({
      userId: user._id,
      action: "user_joined_company",
      description: `${user.username} joined ${company.name}`,
      resourceType: "company",
      resourceId: company._id,
      companyId: company._id,
      req
    });

    console.log(`✅ ${user.email} accepted invite and joined ${company.name}`);

    return res.json({
      message: "Invitation accepted successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        companyId: user.companyId,
        companyRole: user.companyRole
      }
    });

  } catch (err) {
    console.error("ACCEPT INVITE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// COMPANY MANAGEMENT
// ============================================================================

/**
 * Get company details
 * GET /api/companies/:id
 */
exports.getCompany = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;

    const company = await Company.findById(companyId)
      .populate("admins.user", "username email profilePicture")
      .populate("defaultWorkspace", "name");

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if user belongs to this company
    const user = await User.findById(userId);
    if (user.companyId && user.companyId.toString() !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json({ company });

  } catch (err) {
    console.error("GET COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get company members
 * GET /api/companies/:id/members
 */
exports.getCompanyMembers = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check access
    const user = await User.findById(userId);
    if (user.companyId && user.companyId.toString() !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const members = await User.find({ companyId })
      .select("username email profilePicture companyRole departments createdAt lastLoginAt isOnline")
      .populate("departments", "name")
      .lean();

    return res.json({ members });

  } catch (err) {
    console.error("GET COMPANY MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update user role in company
 * PUT /api/companies/:id/members/:userId/role
 */
exports.updateMemberRole = async (req, res) => {
  try {
    const { id: companyId, userId: targetUserId } = req.params;
    const requesterId = req.user.sub;
    const { role } = req.body;

    if (!["owner", "admin", "manager", "member", "guest"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Only owners and admins can change roles
    if (!company.isAdmin(requesterId)) {
      return res.status(403).json({ message: "Only company admins can change roles" });
    }

    // Prevent non-owners from assigning owner role
    const requester = await User.findById(requesterId);
    if (role === "owner" && requester.companyRole !== "owner") {
      return res.status(403).json({ message: "Only owners can assign owner role" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.companyId.toString() !== companyId) {
      return res.status(400).json({ message: "User does not belong to this company" });
    }

    // Update role
    targetUser.companyRole = role;
    await targetUser.save();

    // Update company admins array if needed
    if (role === "owner" || role === "admin") {
      const existingAdmin = company.admins.find(
        a => a.user.toString() === targetUserId
      );
      if (!existingAdmin) {
        company.admins.push({ user: targetUserId, role });
        await company.save();
      }
    } else {
      // Remove from admins if downgraded
      company.admins = company.admins.filter(
        a => a.user.toString() !== targetUserId
      );
      await company.save();
    }

    // Log role change
    await logAction({
      userId: requesterId,
      action: "user_role_changed",
      description: `Changed ${targetUser.username}'s role to ${role}`,
      resourceType: "user",
      resourceId: targetUserId,
      companyId,
      metadata: { oldRole: targetUser.companyRole, newRole: role },
      req
    });

    console.log(`✅ Role updated: ${targetUser.email} → ${role}`);

    return res.json({
      message: "Role updated successfully",
      user: {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        companyRole: targetUser.companyRole
      }
    });

  } catch (err) {
    console.error("UPDATE MEMBER ROLE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Check if email can join company (for signup auto-assignment)
 * POST /api/companies/check-eligibility
 */
exports.checkEligibility = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailLower = email.toLowerCase();
    const domain = extractDomain(emailLower);

    // Check for pending invite
    const invite = await Invite.findOne({
      email: emailLower,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate("company", "name logo");

    if (invite) {
      return res.json({
        eligible: true,
        reason: "invite",
        company: invite.company
      });
    }

    if (!domain) {
      return res.json({ eligible: false, reason: "invalid_email" });
    }

    // Check for domain auto-join
    const company = await Company.findOne({
      domain,
      domainVerified: true,
      autoJoinByDomain: true,
      isActive: true
    }).select("name logo domain");

    if (company) {
      return res.json({
        eligible: true,
        reason: "domain_auto_join",
        company
      });
    }

    // Check if email is in allowed emails
    const companyWithAllowedEmail = await Company.findOne({
      allowedEmails: emailLower,
      isActive: true
    }).select("name logo");

    if (companyWithAllowedEmail) {
      return res.json({
        eligible: true,
        reason: "allowed_email",
        company: companyWithAllowedEmail
      });
    }

    return res.json({
      eligible: false,
      reason: "no_match"
    });

  } catch (err) {
    console.error("CHECK ELIGIBILITY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = exports;
