const logger = require('../../../utils/logger');
const registrationService = require("./registration.service");
const org = require("../../identity/queries/org");

exports.registerCompany = async (req, res) => {
    try {
        logger.info("🚀 Starting company registration...");

        
        const { company, _adminUser } = await registrationService.registerCompany({
            ...req.body,
            req
        });

        logger.info(`✅ Company "${company.name}" registered (PENDING VERIFICATION).`);

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
        logger.error("❌ REGISTER COMPANY ERROR:", err.message);

        
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

exports.verifyCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const { decision, rejectionReason } = req.body;

        
        

        const company = await org.companies.findOne({ _id: companyId });
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (company.verificationStatus !== "pending") {
            return res.status(400).json({
                message: `Company already ${company.verificationStatus}. Cannot change status.`
            });
        }

        if (decision === "approve") {
            logger.info(`✅ Approving company: ${company.name}...`);

            
            await org.updateCompany(companyId, { verificationStatus: "approved" });

            
            
            
            try {
                await registrationService.provisionCompanyResources({
                    companyId,
                    req
                });

                logger.info(`✅ Company "${company.name}" verified and provisioned successfully.`);

                return res.json({
                    message: "Company approved and resources provisioned",
                    status: "approved"
                });
            } catch (provisionErr) {
                logger.error("Provisioning error:", provisionErr);
                
                await org.updateCompany(companyId, { verificationStatus: "pending" });

                return res.status(500).json({
                    message: "Failed to provision resources",
                    error: provisionErr.message
                });
            }

        } else if (decision === "reject") {
            await org.updateCompany(companyId, { verificationStatus: "rejected", rejectionReason: rejectionReason || "Not specified" });

            logger.info(`❌ Company "${company.name}" rejected.`);

            return res.json({
                message: "Company registration rejected",
                status: "rejected"
            });

        } else {
            return res.status(400).json({ message: "Invalid decision. Use 'approve' or 'reject'." });
        }

    } catch (err) {
        logger.error("VERIFY COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.startSetup = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { plan, acceptedTerms } = req.body;

        const company = await org.companies.findOne({ _id: companyId });
        if (!company) return res.status(404).json({ message: "Company not found" });

        if (!company.isAdmin(userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        }
        // Collected below and written once.
        const patch = {};

        if (company.isSetupComplete) {
            return res.status(400).json({ message: "Setup already complete" });
        }

        
        // The plan is an owner decision.
        if (plan && req.companyRole === 'owner') patch.plan = plan.toLowerCase();
        if (acceptedTerms) patch.metadata = { acceptedTermsAt: new Date(), acceptedTermsBy: userId };

        patch.setupStep = 1;
        const updated = await org.updateCompany(companyId, patch);

        return res.json({
            message: "Setup started",
            step: updated.setupStep
        });

    } catch (err) {
        logger.error("START SETUP ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.updateCompanySetup = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { step, data } = req.body;

        const company = await org.companies.findOne({ _id: companyId });
        if (!company) return res.status(404).json({ message: "Company not found" });

        if (!company.isAdmin(userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        }
        // Collected below and written once.
        const patch = {};

        
        if (step === 1) { 
            if (data.displayName) patch.displayName = data.displayName;
            patch.setupStep = 1;
        } else if (step === 2) { 
            if (data.departments && Array.isArray(data.departments)) {
                patch.metadata = { finalDepartments: data.departments };
            }
            patch.setupStep = 2;
        } else if (step === 3) {
            if (data.invites && Array.isArray(data.invites)) {
                patch.metadata = { finalInvites: data.invites };
            }
            patch.setupStep = 3;
        } else if (step === 4) { 
            logger.info("🚀 Finalizing Company Setup & Provisioning Resources...");

            
            const departmentsToCreate = company.metadata?.finalDepartments || [];

            
            const existingDepartments = departmentsToCreate.length
                ? await org.departments.find({ company: company._id, name: { $in: departmentsToCreate } }, { members: false })
                : [];

            const existingDeptNames = existingDepartments.map(d => d.name);
            const newDepartmentNames = departmentsToCreate.filter(
                name => !existingDeptNames.includes(name)
            );

            const createdDepartmentIds = [];

            const { withTransaction } = require('../../shared/postgres');
            await withTransaction(async (tx) => {
                for (const deptName of newDepartmentNames) {
                    const dept = await org.insert('departments', { name: deptName, company: company._id, head: userId }, { tx });
                    createdDepartmentIds.push(dept._id);
                }
                const allIds = [...createdDepartmentIds, ...existingDepartments.map(d => d._id)];
                // The owner joins every department (existing memberships are kept).
                for (const deptId of allIds) await org.addDepartmentMembers(deptId, [userId], 'member', { tx });
            });
            for (const deptName of newDepartmentNames) logger.info(`✅ Created new department: ${deptName}`);

            const allDepartmentIds = [
                ...createdDepartmentIds,
                ...existingDepartments.map(d => d._id)
            ];
            logger.info(`✅ Updated owner's departments: ${allDepartmentIds.length} departments`);

            if (existingDeptNames.length > 0) {
                logger.info(`ℹ️ Skipped ${existingDeptNames.length} existing departments:`, existingDeptNames);
            }

            await org.updateCompany(companyId, { ...patch, isSetupComplete: true, setupStep: 4 });

            logger.info(`✅ Setup complete for company: ${company.name}`);

            return res.json({
                message: "Setup complete",
                isSetupComplete: true,
                redirectTo: "/owner/dashboard",
                departmentsCreated: newDepartmentNames.length,
                departmentsExisting: existingDeptNames.length,
                departmentsTotal: allDepartmentIds.length
            });
        }

        const updated = await org.updateCompany(companyId, patch);

        return res.json({
            message: "Setup updated",
            step: updated.setupStep,
            isSetupComplete: updated.isSetupComplete
        });

    } catch (err) {
        logger.error("SETUP ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
