// src/features/company/company.controller.js

const companyService = require("./company.service");
const Company = require("../../../models/Company");
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Memory-based multer for setup (logo image + excel file)
const setupUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * Get company details
 * GET /api/companies/:id
 */
exports.getCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        // Use service layer
        const company = await companyService.getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check access
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        return res.json({ company });

    } catch (err) {
        console.error("GET COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update company settings
 * PUT /api/companies/:id
 */
exports.updateCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const updates = req.body;

        // Check if user is admin
        const { isAdmin } = await companyService.checkIsAdmin(userId, companyId);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admins can update company settings" });
        }

        // Use service layer
        const company = await companyService.updateCompany(companyId, updates);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({ company });

    } catch (err) {
        console.error("UPDATE COMPANY ERROR:", err);
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

        // Check company exists
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check access
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Use service layer
        console.log(`[COMPANY] Fetching members for company ${companyId}`);
        const members = await companyService.getCompanyMembers(companyId);
        console.log(`[COMPANY] Found ${members.length} members`);

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

        // Use service layer
        const result = await companyService.updateMemberRole({
            companyId,
            targetUserId,
            requesterId,
            role,
            req
        });

        return res.json(result);

    } catch (err) {
        console.error("UPDATE MEMBER ROLE ERROR:", err);

        if (err.message.includes('not found') || err.message.includes('Invalid')) {
            return res.status(400).json({ message: err.message });
        }
        if (err.message.includes('Only') || err.message.includes('cannot')) {
            return res.status(403).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if company name is available
 * POST /api/companies/check-name
 */
exports.checkCompanyName = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Company name is required" });
        }

        const existingCompany = await Company.findOne({ name: new RegExp(`^${name}$`, 'i') });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Company name already taken" : "Company name is available"
        });
    } catch (err) {
        console.error("CHECK COMPANY NAME ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if company domain is available
 * POST /api/companies/check-domain
 */
exports.checkCompanyDomain = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) {
            return res.status(400).json({ message: "Domain is required" });
        }

        const existingCompany = await Company.findOne({ domain: domain.toLowerCase() });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Domain already registered" : "Domain is available"
        });
    } catch (err) {
        console.error("CHECK COMPANY DOMAIN ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if email exists
 * POST /api/companies/check-email
 */
exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const User = require("../../../models/User");
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        return res.json({
            available: !existingUser,
            message: existingUser ? "Email already in use" : "Email is available"
        });
    } catch (err) {
        console.error("CHECK EMAIL ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Check if phone exists
 * POST /api/companies/check-phone
 */
exports.checkPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: "Phone is required" });
        }

        const User = require("../../../models/User");
        const existingUser = await User.findOne({ phone });
        const existingCompany = await Company.findOne({ ownerPhone: phone });

        return res.json({
            available: !existingUser && !existingCompany,
            message: (existingUser || existingCompany) ? "Phone already registered" : "Phone is available"
        });
    } catch (err) {
        console.error("CHECK PHONE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Start setup — accept terms
 * POST /api/companies/:id/start-setup
 */
exports.startSetup = async (req, res) => {
    try {
        const { id: companyId } = req.params;
        const userId = req.user.sub;

        const { isAdmin } = await companyService.checkIsAdmin(userId, companyId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only company admins can start setup' });
        }

        const company = await Company.findByIdAndUpdate(
            companyId,
            {
                $set: {
                    setupStep: 1,
                    'metadata.termsAcceptedAt': new Date(),
                    'metadata.termsAcceptedBy': userId
                }
            },
            { new: true }
        );

        if (!company) return res.status(404).json({ message: 'Company not found' });

        return res.json({ message: 'Setup started', company });
    } catch (err) {
        console.error('START SETUP ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Handle setup steps (multipart/form-data)
 * PUT /api/companies/:id/setup
 * Body: step (number), data (JSON string), file (optional)
 */
exports.handleSetup = (req, res) => {
    // Use multer fields: 'logo' for step1, 'employeeFile' for step3
    const upload = setupUpload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'employeeFile', maxCount: 1 }
    ]);

    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        try {
            const { id: companyId } = req.params;
            const userId = req.user.sub;

            const { isAdmin } = await companyService.checkIsAdmin(userId, companyId);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Only admins can configure setup' });
            }

            let stepData = {};
            try {
                stepData = req.body.data ? JSON.parse(req.body.data) : req.body;
            } catch (_) {
                stepData = req.body;
            }

            const step = parseInt(req.body.step || stepData.step || 1);

            const result = await companyService.processSetupStep({
                companyId,
                userId,
                step,
                data: stepData,
                files: req.files || {}
            });

            return res.json(result);
        } catch (err2) {
            console.error('HANDLE SETUP ERROR:', err2);
            return res.status(500).json({ message: err2.message || 'Server error' });
        }
    });
};

/**
 * Download sample employee Excel template
 * GET /api/companies/:id/setup/template
 */
exports.downloadTemplate = async (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        // Headers MUST match the column guide A-J exactly
        const headers = [
            'First Name',   // A
            'Last Name',    // B
            'Email',        // C – Work email (company domain) — Required
            'Pers. Email',  // D – Personal email (credentials sent here)
            'Job Title',    // E
            'Join Date',    // F – YYYY-MM-DD
            'Mobile',       // G – Phone no. — Required
            'Corp ID',      // H – e.g. EMP001
            'Role',         // I – member/admin/manager
            'Department'    // J – Team name
        ];
        const samples = [
            ['Aarav',  'Sharma',  'aarav.sharma@kt.com',  'kthrishank.9@gmail.com',   'Software Engineer',    '2024-06-10', '9876543210', 'KT1001', 'admin',   'Engineering'],
            ['Neha',   'Reddy',   'neha.reddy@kt.com',    'kthrishank10@gmail.com',   'Engineering Manager',  '2023-03-15', '9876543211', 'KT1002', 'manager', 'Engineering'],
            ['Rohan',  'Mehta',   'rohan.mehta@kt.com',   'tkuntimaddi@gmail.com',    'Engineering Manager',  '2023-07-21', '9876543212', 'KT1003', 'manager', 'Engineering'],
            ['Isha',   'Kapoor',  'isha.kapoor@kt.com',   'kuntimaddit@gmail.com',    'Backend Engineer',     '2024-01-05', '9876543213', 'KT1004', 'member',  'Engineering'],
            ['Vikram', 'Nair',    'vikram.nair@kt.com',   'kthrishank2003@gmail.com', 'Frontend Engineer',    '2024-02-11', '9876543214', 'KT1005', 'member',  'Engineering'],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
        ws['!cols'] = [
            { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 28 },
            { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="chttrix_team_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
    } catch (err) {
        console.error('DOWNLOAD TEMPLATE ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

