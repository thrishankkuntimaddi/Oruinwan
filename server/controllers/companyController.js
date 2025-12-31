// server/controllers/companyController.js

const Company = require("../models/Company");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Invite = require("../models/Invite");
const Department = require("../models/Department");
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
// OTP STORE (In-Memory for Development)
// ============================================================================
const otpStore = new Map();

/**
 * Send OTP (Dev Mode: Logs to Terminal)
 * POST /api/companies/otp/send
 * Body: { target: string, type: 'email' | 'phone' }
 */
exports.sendOtp = async (req, res) => {
  try {
    const { target, type } = req.body;
    if (!target) return res.status(400).json({ message: "Target is required" });

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store with 5-minute expiration
    otpStore.set(target, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    // ---------------------------------------------------------
    // DEVELOPMENT LOGGING
    // ---------------------------------------------------------
    console.log("\n============================================");
    console.log(`🔐 [DEV OTP] Verification Code for ${type} (${target})`);
    console.log(`👉 CODE: ${otp}`);
    console.log("============================================\n");
    // ---------------------------------------------------------

    // In production, you would trigger SMS/Email service here

    return res.json({
      message: "OTP sent successfully",
      devNote: "Check server terminal for code"
    });
  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Verify OTP
 * POST /api/companies/otp/verify
 * Body: { target: string, otp: string }
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { target, otp } = req.body;

    if (!target || !otp) {
      return res.status(400).json({ message: "Target and OTP are required" });
    }

    const data = otpStore.get(target);

    if (!data) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }

    if (Date.now() > data.expires) {
      otpStore.delete(target);
      return res.status(400).json({ message: "OTP expired" });
    }

    if (data.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP Valid
    otpStore.delete(target); // Consume OTP
    return res.json({ message: "Verified successfully", verified: true });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

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
      adminPassword,
      domain,
      documents,
      // Enhanced Fields
      personalEmail,
      phone,
      role, // This comes as "Owner", "Admin", "PA", "Manager" or custom string

      departments = [], // Will be stored in metadata for later
      workspaceName, // Will be stored in metadata for later
      workspaceDescription, // Will be stored in metadata for later
      defaultChannels = ["general", "announcements"], // Will be stored in metadata for later
    } = req.body;

    console.log("🚀 [CHECKPOINT 1] Starting company registration...");
    console.log("📦 Received payload:", { companyName, adminEmail, domain });

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

    // Validate domain if provided
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

    // Process Documents (Simple Local Storage)
    const fs = require('fs');
    const path = require('path');
    const processedDocuments = [];

    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        // Check if it has content (base64)
        if (doc.content && doc.name) {
          try {
            // Strip header "data:application/pdf;base64,"
            const base64Data = doc.content.replace(/^data:([A-Za-z-+/]+);base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            const uniqueName = `${Date.now()}_${doc.name.replace(/\s+/g, '_')}`;
            const uploadDir = path.join(__dirname, '../uploads/verification_docs');

            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, uniqueName);
            fs.writeFileSync(filePath, buffer);

            processedDocuments.push({
              name: doc.name,
              url: `/uploads/verification_docs/${uniqueName}`, // Public URL
              uploadedAt: new Date()
            });

            console.log(`✅ File saved: ${filePath}`);
          } catch (err) {
            console.error("File write error:", err);
            // Continue without failing (or decide to fail)
          }
        }
      }
    }


    // Step 1: Create Company (Status: PENDING)
    // We do NOT create workspaces, channels, or departments yet.
    console.log("📝 Creating pending company...");

    const company = new Company({
      name: companyName,
      ...(domain ? { domain: domain.toLowerCase() } : {}), // Only set if provided
      domainVerified: false,
      documents: processedDocuments, // Save the processed URLs
      billingEmail: adminEmail,
      verificationStatus: "pending", // Enforce pending status
      metadata: {
        // Store the requested configuration for the verification phase
        requestedDepartments: departments,
        requestedWorkspaceName: workspaceName,
        requestedWorkspaceDescription: workspaceDescription,
        requestedChannels: defaultChannels
      }
    });

    await company.save();

    // Step 2: Create Admin User (Status: PENDING_COMPANY)
    console.log("👤 Creating pending admin user...");
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = new User({
      username: adminName,
      email: adminEmail,
      passwordHash,
      userType: "company",
      companyId: company._id,
      companyRole: "owner", // Always 'owner' for the creator
      jobTitle: role || "Owner", // Store the self-declared role as Job Title
      phone: phone || undefined,
      phoneCode: req.body.phoneCode || "+1",
      emails: personalEmail ? [{ email: personalEmail, isPrimary: false, verified: true }] : [], // Assuming auto-verified since we did OTP
      verified: true, // Admin is verified as a user, but their access is blocked by accountStatus
      accountStatus: "pending_company",
      departments: [] // No departments yet
    });

    try {
      await adminUser.save();
    } catch (err) {
      // Cleanup company if user creation fails
      await Company.findByIdAndDelete(company._id);
      throw new Error(`Failed to create admin user: ${err.message}`);
    }

    // Step 3: Link Admin to Company
    company.admins.push({
      user: adminUser._id,
      role: "owner"
    });
    await company.save();

    // Log the request
    await logAction({
      userId: adminUser._id,
      action: "company_registration_requested",
      description: `Company "${companyName}" registration submitted for verification`,
      resourceType: "company",
      resourceId: company._id,
      companyId: company._id,
      metadata: { companyName, domain, role },
      req
    });

    console.log(`✅ Company "${companyName}" registered (PENDING VERIFICATION).`);

    return res.status(201).json({
      message: "Company registration submitted successfully. Your account is pending internal verification.",
      status: "pending_verification",
      company: {
        id: company._id,
        name: company.name,
        verificationStatus: "pending"
      }
    });

  } catch (err) {
    console.error("❌ REGISTER COMPANY ERROR:");
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack);
    console.error("Full Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Internal: Verify Company & Provision Resources
 * POST /api/companies/:id/verify
 * Body: { decision: "approve" | "reject", rejectionReason: string }
 */
exports.verifyCompany = async (req, res) => {
  try {
    const companyId = req.params.id;
    const { decision, rejectionReason } = req.body;

    // In a real app, strict admin permissions checking here
    // For now, assume this endpoint is protected by an internal admin middleware

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (company.verificationStatus !== 'pending') {
      return res.status(400).json({ message: `Company is already ${company.verificationStatus}` });
    }

    // Find the pending owner
    const ownerAdmin = company.admins.find(a => a.role === 'owner');
    if (!ownerAdmin) {
      return res.status(500).json({ message: "Data corruption: Company has no owner" });
    }

    const adminUser = await User.findById(ownerAdmin.user);
    if (!adminUser) {
      return res.status(404).json({ message: "Company owner user not found" });
    }

    if (decision === 'reject') {
      company.verificationStatus = 'rejected';
      company.suspensionReason = rejectionReason || "Does not meet criteria";
      await company.save();

      // Update user status
      adminUser.accountStatus = 'suspended';
      await adminUser.save();

      // TODO: Send rejection email

      return res.json({ message: "Company rejected", status: "rejected" });
    }

    if (decision === 'approve') {
      console.log(`🚀 Starting provisioning for company: ${company.name}`);

      // 1. Update Status
      company.verificationStatus = 'verified';

      // 2. Provision Resources (Logic moved from registerCompany)
      const metadata = company.metadata || {};
      const {
        requestedDepartments = [],
        requestedWorkspaceName,
        requestedWorkspaceDescription,
        requestedChannels = ["general", "announcements"]
      } = metadata;

      // A. Create Departments & Workspaces
      const createdDepartmentIds = [];
      const workspaceName = requestedWorkspaceName || `${company.name} Workspace`;

      // Helper function to create workspace & channels
      const createWorkspaceForDept = async (deptName, deptId, isDefault = false) => {
        const ws = new Workspace({
          company: company._id,
          type: "company",
          name: isDefault ? workspaceName : `${deptName}`, // "Engineering" Workspace
          description: isDefault ? "Primary company workspace" : `${deptName} Team Workspace`,
          createdBy: adminUser._id,
          department: deptId ? deptId : undefined, // Link to Department
          members: [{ user: adminUser._id, role: "owner" }]
        });
        await ws.save();

        // Create Default Channels (General, Announcement)
        const channelsToCreate = ["general", "announcement"];
        const createdChanIds = [];

        for (const channelName of channelsToCreate) {
          const chan = new Channel({
            workspace: ws._id,
            company: company._id,
            name: channelName,
            isDefault: true,
            createdBy: adminUser._id,
            members: [{ user: adminUser._id, joinedAt: new Date() }]
          });
          await chan.save();
          createdChanIds.push(chan._id);
        }

        ws.defaultChannels = createdChanIds;
        await ws.save();
        return ws;
      };

      // 1. Create Requested Departments + Their Workspaces
      for (const deptName of requestedDepartments) {
        const dept = new Department({
          company: company._id,
          name: deptName,
          description: `${deptName} Department`,
          head: adminUser._id, // Assign owner as initial head (can be changed later)
          members: [adminUser._id]
        });
        await dept.save();
        createdDepartmentIds.push(dept._id);

        // Auto-create workspace for this department
        const deptWs = await createWorkspaceForDept(deptName, dept._id);

        // Link workspace to department
        dept.workspaces = [deptWs._id];
        await dept.save();
      }

      // B. Create MAIN Default Workspace (if not created via departments)
      // If no departments were requested, we still need at least one workspace
      const defaultWorkspace = await createWorkspaceForDept("General", null, true);

      // 3. Update Company & User References
      company.defaultWorkspace = defaultWorkspace._id;
      await company.save();

      adminUser.accountStatus = 'active'; // ACTIVATE USER
      adminUser.departments = createdDepartmentIds;
      adminUser.workspaces.push({
        workspace: defaultWorkspace._id,
        role: "owner"
      });
      await adminUser.save();

      // TODO: Send activation email

      return res.json({
        message: "Company verified and provisioned successfully",
        status: "verified",
        workspaceId: defaultWorkspace._id
      });
    }

    return res.status(400).json({ message: "Invalid decision" });

  } catch (err) {
    console.error("VERIFY COMPANY ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
};


/**
 * Start Company Setup (Transition from Confirm -> Wizard)
 * POST /api/companies/:id/start-setup
 */
exports.startSetup = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const { plan, acceptedTerms } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Check admin
    if (typeof company.isAdmin === 'function' && !company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can perform setup" });
    } else if (!company.isAdmin && company.admins.every(a => a.user.toString() !== userId)) {
      return res.status(403).json({ message: "Only admins can perform setup" });
    }

    if (company.isSetupComplete) {
      return res.status(400).json({ message: "Setup already complete" });
    }

    // Save Selection
    if (plan) company.plan = plan.toLowerCase(); // free, starter, etc
    if (acceptedTerms) company.metadata = { ...company.metadata, acceptedTermsAt: new Date(), acceptedTermsBy: userId };

    // Move to Step 1 (Wizard Start)
    company.setupStep = 1;
    await company.save();

    return res.json({
      message: "Setup started",
      step: company.setupStep
    });

  } catch (err) {
    console.error("START SETUP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Complete Company Setup (Phase 4)
 * PUT /api/companies/:id/setup
 * Body: { step: number, data: object }
 */
exports.updateCompanySetup = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const { step, data } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Use isAdmin helper if available, or manual check
    // Assuming company.isAdmin(userId) is valid as seen in other methods
    if (typeof company.isAdmin === 'function' && !company.isAdmin(userId)) {
      return res.status(403).json({ message: "Only admins can perform setup" });
    } else if (!company.isAdmin && company.admins.every(a => a.user.toString() !== userId)) {
      // Fallback if method missing
      return res.status(403).json({ message: "Only admins can perform setup" });
    }

    // Handle steps
    if (step === 1) { // Profile (Logo, Timezone)
      if (data.displayName) company.displayName = data.displayName;
      // Handle logo upload logic here if needed (presigned url etc)
      // company.logo = data.logoUrl; 
      company.setupStep = 1;
    } else if (step === 2) { // Departments
      // Save departments to metadata for processing in Step 4
      if (data.departments && Array.isArray(data.departments)) {
        company.metadata = {
          ...company.metadata,
          finalDepartments: data.departments
        };
      }
      company.setupStep = 2;
    } else if (step === 3) {
      // Step 3: Store Invites for processing in Step 4 (Launch)
      if (data.invites && Array.isArray(data.invites)) {
        company.metadata = {
          ...company.metadata,
          finalInvites: data.invites
        };
      }
      company.setupStep = 3;
    } else if (step === 4) { // Complete
      console.log("🚀 Finalizing Company Setup & Provisioning Resources...");

      // 1. Get the final list of departments
      const finalDepartments = company.metadata.finalDepartments || company.metadata.requestedDepartments || [];

      // Helper to create workspace (reused logic)
      const createWorkspaceForDept = async (deptName, deptId, isDefault = false) => {
        // Check if workspace already exists for this department
        if (deptId) {
          const existingWs = await Workspace.findOne({ company: company._id, department: deptId });
          if (existingWs) return existingWs;
        }

        const wsName = isDefault ? `${company.name} Workspace` : `${deptName}`;
        const wsDesc = isDefault ? "Primary company workspace" : `${deptName} Team Workspace`;

        const ws = new Workspace({
          company: company._id,
          type: "company",
          name: wsName,
          description: wsDesc,
          createdBy: userId,
          department: deptId ? deptId : undefined,
          members: [{ user: userId, role: "owner" }]
        });
        await ws.save();

        // Create Default Channels
        const channelsToCreate = ["general", "announcement"];
        const createdChanIds = [];
        for (const channelName of channelsToCreate) {
          const chan = new Channel({
            workspace: ws._id,
            company: company._id,
            name: channelName,
            isDefault: true,
            createdBy: userId,
            members: [{ user: userId, joinedAt: new Date() }]
          });
          await chan.save();
          createdChanIds.push(chan._id);
        }
        ws.defaultChannels = createdChanIds;
        await ws.save();
        return ws;
      };

      // 2. Process Departments
      const createdDepartmentIds = [];
      const user = await User.findById(userId);

      for (const deptName of finalDepartments) {
        // Check if department already exists
        let dept = await Department.findOne({ company: company._id, name: deptName });

        if (!dept) {
          dept = new Department({
            company: company._id,
            name: deptName,
            description: `${deptName} Department`,
            head: userId,
            members: [userId]
          });
          await dept.save();
        }
        createdDepartmentIds.push(dept._id);

        // Ensure Workspace exists for this department
        const deptWs = await createWorkspaceForDept(deptName, dept._id);

        // Link workspace if not linked
        if (!dept.workspaces.includes(deptWs._id)) {
          dept.workspaces.push(deptWs._id);
          await dept.save();
        }
      }

      // 3. Process Invites & Create Users
      if (company.metadata.finalInvites && company.metadata.finalInvites.length > 0) {
        console.log("👥 Processing Pending Invites & Creating Accounts...");
        const invitesToProcess = company.metadata.finalInvites.filter(i => i.email && i.email.trim() !== "");
        const departmentMap = {}; // Name -> ID mapping

        // Build map from created departments
        const allDepts = await Department.find({ company: company._id });
        allDepts.forEach(d => departmentMap[d.name] = d._id);

        for (const inviteData of invitesToProcess) {
          try {
            const { name, email, role, department } = inviteData;
            const normalizedEmail = email.toLowerCase();

            // Check if user already exists
            let newUser = await User.findOne({ email: normalizedEmail });
            if (newUser) {
              console.log(`⚠️ User ${normalizedEmail} already exists, skipping creation.`);
              continue;
            }

            // Generate Temporary Password
            const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            // Resolve Department ID
            const targetDeptId = department ? departmentMap[department] : null;
            const userDepts = targetDeptId ? [targetDeptId] : [];

            newUser = new User({
              username: name || email.split('@')[0],
              email: normalizedEmail,
              passwordHash,
              userType: 'company',
              companyId: company._id,
              companyRole: role || 'member',
              departments: userDepts,
              accountStatus: 'active', // Or 'pending_invite' if you want them to verify first, but requirement implies immediate access
              verified: true // Assume verified by admin
            });

            await newUser.save();

            // Link to Department Member List
            if (targetDeptId) {
              await Department.findByIdAndUpdate(targetDeptId, { $addToSet: { members: newUser._id } });
            }

            // Send Welcome Email (Mock)
            console.log("\n" + "=".repeat(80));
            console.log(`📧 WELCOME EMAIL TO: ${normalizedEmail}`);
            console.log(`Subject: Welcome to ${company.name} - Your Account is Ready`);
            console.log("-".repeat(80));
            console.log(`Dear ${name || 'Team Member'},`);
            console.log(`Your account has been created by your admin.`);
            console.log(`\nLogin Details:`);
            console.log(`URL: ${process.env.FRONTEND_URL}/login`);
            console.log(`Email: ${normalizedEmail}`);
            console.log(`Temporary Password: ${tempPassword}`);
            console.log(`\nPlease change this password after your first login.`);
            console.log("=".repeat(80) + "\n");

          } catch (e) {
            console.error(`Error creating user for ${inviteData.email}:`, e);
          }
        }
      }

      // 3. Ensure User is linked to these departments
      const newDeptIds = [...new Set([...(user.departments || []), ...createdDepartmentIds])];
      user.departments = newDeptIds;

      // Update User Managed Departments
      user.managedDepartments = [...new Set([...(user.managedDepartments || []), ...createdDepartmentIds])];

      // 4. Ensure Default Workspace exists (fallback)
      if (!company.defaultWorkspace) {
        const defWs = await createWorkspaceForDept("General", null, true);
        company.defaultWorkspace = defWs._id;

        if (!user.workspaces.some(w => w.workspace.toString() === defWs._id.toString())) {
          user.workspaces.push({ workspace: defWs._id, role: "owner" });
        }
      }

      user.isCoOwner = true;
      await user.save();

      company.isSetupComplete = true;
      company.setupStep = 4;
      await company.save();

      return res.json({
        message: "Setup complete",
        isSetupComplete: true,
        redirectTo: "/admin/analytics"
      });
    }

    await company.save();

    return res.json({
      message: "Setup updated",
      step: company.setupStep,
      isSetupComplete: company.isSetupComplete
    });

  } catch (err) {
    console.error("SETUP ERROR:", err);
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
    // Enhanced to accept departmentId and extra metadata
    const { email, role = "member", workspaceId = null, departmentId = null, managerId = null } = req.body;

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
      department: departmentId, // Store department
      metadata: { managerId },  // Store manager
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });


    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;

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
 * Method 4: Admin Direct Create Employee (No Email Confirmation)
 * POST /api/companies/:id/employees/create
 */
exports.directCreateEmployee = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user.sub;
    const {
      username,
      email,
      password,
      role = "member",
      department,
      jobTitle
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required"
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Only admins can directly create employees
    if (!company.isAdmin(userId)) {
      return res.status(403).json({
        message: "Only company admins can create employees directly"
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        message: "Email already in use"
      });
    }

    // Create user account
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
      userType: "company",
      companyId: company._id,
      companyRole: role,
      verified: true, // Auto-verified since created by admin
      jobTitle,
      departments: department ? [department] : []
    });

    await newUser.save();

    // Add to default workspace
    if (company.defaultWorkspace) {
      const workspace = await Workspace.findById(company.defaultWorkspace);

      if (workspace && !workspace.isMember(newUser._id)) {
        workspace.members.push({
          user: newUser._id,
          role: "member"
        });
        await workspace.save();

        newUser.workspaces.push({
          workspace: workspace._id,
          role: "member"
        });

        // Add to default channels
        const defaultChannels = await Channel.find({
          workspace: workspace._id,
          isDefault: true
        });

        for (const channel of defaultChannels) {
          if (!channel.members.some(m => (m.user ? m.user.toString() : m.toString()) === newUser._id.toString())) {
            // 🔧 FIX: Convert all existing members to new format before adding new member
            channel.members = channel.members.map(m => {
              if (m.user) return m;
              return {
                user: m,
                joinedAt: channel.createdAt || new Date()
              };
            });

            channel.members.push({
              user: newUser._id,
              joinedAt: new Date()
            });
            await channel.save();

          }
        }

        await newUser.save();

      }
    }

    // Log action
    await logAction({
      userId,
      action: "employee_created_direct",
      description: `Admin directly created employee: ${username}`,
      resourceType: "user",
      resourceId: newUser._id,
      companyId: company._id,
      metadata: { email, role },
      req
    });

    return res.json({
      message: "Employee account created successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        companyRole: newUser.companyRole,
        verified: newUser.verified
      },
      credentials: {
        email: newUser.email,
        temporaryPassword: password // Send back so admin can share with employee
      }
    });

  } catch (err) {
    console.error("DIRECT CREATE EMPLOYEE ERROR:", err);
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
          if (!channel.members.some(m => (m.user ? m.user.toString() : m.toString()) === user._id.toString())) {
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
          if (!channel.members.some(m => (m.user ? m.user.toString() : m.toString()) === user._id.toString())) {
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
      .select("username email profilePicture companyRole createdAt lastLoginAt isOnline")
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
