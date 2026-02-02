// src/features/company-registration/registration.controller.js

const registrationService = require("./registration.service");
const Company = require("../../../models/Company");
const Department = require("../../../models/Department");
const User = require("../../../models/User");

/**
 * Register new company (pending verification)
 * POST /api/companies/register
 */
exports.registerCompany = async (req, res) => {
    try {
        console.log("🚀 Starting company registration...");

        // Use registration service
        const { company, adminUser } = await registrationService.registerCompany({
            ...req.body,
            req
        });

        console.log(`✅ Company "${company.name}" registered (PENDING VERIFICATION).`);

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
        console.error("❌ REGISTER COMPANY ERROR:", err.message);

        // Handle specific errors with appropriate status codes
        const errorStatusMap = {
            'Company name, admin name, email, and password are required': 400,
            'Personal email is already linked to a registered company': 409,
            'Phone number is already associated with a registered company': 409,
            'Admin email already in use': 409,
            'Invalid domain format': 400,
            'Domain already registered': 409
        };

        const statusCode = errorStatusMap[err.message] || 500;

        return res.status(statusCode).json({
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

/**
 * Verify company and provision resources (Admin only)
 * POST /api/companies/:id/verify
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

        if (company.verificationStatus !== "pending") {
            return res.status(400).json({
                message: `Company already ${company.verificationStatus}. Cannot change status.`
            });
        }

        if (decision === "approve") {
            console.log(`✅ Approving company: ${company.name}...`);

            // Mark as approved first
            company.verificationStatus = "approved";
            await company.save();

            // Use registration service to provision resources
            // Note: This contains complex provisioning logic that might need to stay inline
            // or be extracted to a separate provisioning service
            try {
                await registrationService.provisionCompanyResources({
                    companyId,
                    req
                });

                console.log(`✅ Company "${company.name}" verified and provisioned successfully.`);

                return res.json({
                    message: "Company approved and resources provisioned",
                    status: "approved"
                });
            } catch (provisionErr) {
                console.error("Provisioning error:", provisionErr);
                // Rollback approval
                company.verificationStatus = "pending";
                await company.save();

                return res.status(500).json({
                    message: "Failed to provision resources",
                    error: provisionErr.message
                });
            }

        } else if (decision === "reject") {
            company.verificationStatus = "rejected";
            company.rejectionReason = rejectionReason || "Not specified";
            await company.save();

            console.log(`❌ Company "${company.name}" rejected.`);

            return res.json({
                message: "Company registration rejected",
                status: "rejected"
            });

        } else {
            return res.status(400).json({ message: "Invalid decision. Use 'approve' or 'reject'." });
        }

    } catch (err) {
        console.error("VERIFY COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
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
 * 
 * NOTE: This function contains complex provisioning logic that should ideally
 * be extracted to a provisioning service. Kept inline for now to avoid breaking changes.
 */
exports.updateCompanySetup = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { step, data } = req.body;

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: "Company not found" });

        // Use isAdmin helper if available, or manual check
        if (typeof company.isAdmin === 'function' && !company.isAdmin(userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        } else if (!company.isAdmin && company.admins.every(a => a.user.toString() !== userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        }

        // Handle steps (simplified - full logic remains in original controller for now)
        if (step === 1) { // Profile (Logo, Timezone)
            if (data.displayName) company.displayName = data.displayName;
            company.setupStep = 1;
        } else if (step === 2) { // Departments
            if (data.departments && Array.isArray(data.departments)) {
                company.metadata = {
                    ...company.metadata,
                    finalDepartments: data.departments
                };
            }
            company.setupStep = 2;
        } else if (step === 3) {
            if (data.invites && Array.isArray(data.invites)) {
                company.metadata = {
                    ...company.metadata,
                    finalInvites: data.invites
                };
            }
            company.setupStep = 3;
        } else if (step === 4) { // Complete
            console.log("🚀 Finalizing Company Setup & Provisioning Resources...");

            // Create departments from setup wizard
            const departmentsToCreate = company.metadata?.finalDepartments || [];
            const createdDepartmentIds = [];

            for (const deptName of departmentsToCreate) {
                const dept = new Department({
                    name: deptName,
                    company: company._id,
                    head: userId,  // Owner who completed setup
                    members: [userId],
                    createdAt: new Date()
                });
                await dept.save();
                createdDepartmentIds.push(dept._id);
                console.log(`✅ Created department: ${deptName}`);
            }

            // Update owner's departments
            const ownerUser = await User.findById(userId);
            if (ownerUser) {
                ownerUser.departments = createdDepartmentIds;
                await ownerUser.save();
                console.log(`✅ Updated owner's departments: ${createdDepartmentIds.length} departments`);
            }

            company.isSetupComplete = true;
            company.setupStep = 4;
            await company.save();

            console.log(`✅ Setup complete for company: ${company.name}`);

            return res.json({
                message: "Setup complete",
                isSetupComplete: true,
                redirectTo: "/owner/dashboard",
                departmentsCreated: createdDepartmentIds.length
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
