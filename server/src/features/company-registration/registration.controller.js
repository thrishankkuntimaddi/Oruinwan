const registrationService = require("./registration.service");
const Company = require("../../../models/Company");
const Department = require("../../../models/Department");
const User = require("../../../models/User");

exports.registerCompany = async (req, res) => {
    try {
        console.log("🚀 Starting company registration...");

        
        const { company, _adminUser } = await registrationService.registerCompany({
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

            
            company.verificationStatus = "approved";
            await company.save();

            
            
            
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

exports.startSetup = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { plan, acceptedTerms } = req.body;

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: "Company not found" });

        
        if (typeof company.isAdmin === 'function' && !company.isAdmin(userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        } else if (!company.isAdmin && company.admins.every(a => a.user.toString() !== userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        }

        if (company.isSetupComplete) {
            return res.status(400).json({ message: "Setup already complete" });
        }

        
        if (plan) company.plan = plan.toLowerCase(); 
        if (acceptedTerms) company.metadata = { ...company.metadata, acceptedTermsAt: new Date(), acceptedTermsBy: userId };

        
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

exports.updateCompanySetup = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { step, data } = req.body;

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: "Company not found" });

        
        if (typeof company.isAdmin === 'function' && !company.isAdmin(userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        } else if (!company.isAdmin && company.admins.every(a => a.user.toString() !== userId)) {
            return res.status(403).json({ message: "Only admins can perform setup" });
        }

        
        if (step === 1) { 
            if (data.displayName) company.displayName = data.displayName;
            company.setupStep = 1;
        } else if (step === 2) { 
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
        } else if (step === 4) { 
            console.log("🚀 Finalizing Company Setup & Provisioning Resources...");

            
            const departmentsToCreate = company.metadata?.finalDepartments || [];

            
            const existingDepartments = await Department.find({
                company: company._id,
                name: { $in: departmentsToCreate }
            });

            const existingDeptNames = existingDepartments.map(d => d.name);
            const newDepartmentNames = departmentsToCreate.filter(
                name => !existingDeptNames.includes(name)
            );

            const createdDepartmentIds = [];

            
            for (const deptName of newDepartmentNames) {
                const dept = new Department({
                    name: deptName,
                    company: company._id,
                    head: userId,  
                    members: [userId],
                    createdAt: new Date()
                });
                await dept.save();
                createdDepartmentIds.push(dept._id);
                console.log(`✅ Created new department: ${deptName}`);
            }

            
            const allDepartmentIds = [
                ...createdDepartmentIds,
                ...existingDepartments.map(d => d._id)
            ];

            
            const ownerUser = await User.findById(userId);
            if (ownerUser) {
                
                const existingUserDeptIds = ownerUser.departments.map(id => id.toString());
                const newDeptIds = allDepartmentIds.map(id => id.toString());
                const uniqueDeptIds = [...new Set([...existingUserDeptIds, ...newDeptIds])];

                ownerUser.departments = uniqueDeptIds;
                await ownerUser.save();
                console.log(`✅ Updated owner's departments: ${uniqueDeptIds.length} total departments`);
            }

            
            if (existingDeptNames.length > 0) {
                console.log(`ℹ️ Skipped ${existingDeptNames.length} existing departments:`, existingDeptNames);
            }

            company.isSetupComplete = true;
            company.setupStep = 4;
            await company.save();

            console.log(`✅ Setup complete for company: ${company.name}`);

            return res.json({
                message: "Setup complete",
                isSetupComplete: true,
                redirectTo: "/owner/dashboard",
                departmentsCreated: newDepartmentNames.length,
                departmentsExisting: existingDeptNames.length,
                departmentsTotal: allDepartmentIds.length
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
