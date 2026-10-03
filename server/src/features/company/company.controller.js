const logger = require('../../../utils/logger');
const companyService = require("./company.service");
const identity = require("../../identity");
const org = require("../../identity/queries/org");
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const setupUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, 
});

exports.getCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        
        const company = await companyService.getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        return res.json({ company });

    } catch (err) {
        logger.error("GET COMPANY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.updateCompany = async (req, res) => {
    try {
        const companyId = req.params.id;
        if (String(companyId) !== String(req.companyId)) {
            return res.status(403).json({ message: "Access denied: that company is not yours" });
        }

        const { updates, error, status } = companyService.sanitizeCompanyUpdates(req.body, req.companyRole);
        if (error) return res.status(status).json({ message: error });
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No editable fields in the request" });
        }

        const company = await companyService.updateCompany(companyId, updates);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({ company });

    } catch (err) {
        logger.error("UPDATE COMPANY ERROR:", err);
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ message: err.message });
        }
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getCompanyMembers = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        
        const company = await org.companies.findOne({ _id: companyId }, { admins: false });
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        
        logger.info(`[COMPANY] Fetching members for company ${companyId}`);
        const members = await companyService.getCompanyMembers(companyId, { callerRole: req.companyRole });
        logger.info(`[COMPANY] Found ${members.length} members`);

        return res.json({ members });
    } catch (err) {
        logger.error("GET COMPANY MEMBERS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.updateMemberRole = async (req, res) => {
    try {
        const { id: companyId, userId: targetUserId } = req.params;
        if (String(companyId) !== String(req.companyId)) {
            return res.status(403).json({ message: "Access denied: that company is not yours" });
        }
        const requesterId = req.user.sub;
        const newRole = req.body.role || req.body.newRole;

        const result = await companyService.updateMemberRole({
            companyId,
            targetUserId,
            requesterId,
            newRole,
            req
        });

        return res.json(result);

    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message });
        }
        logger.error("UPDATE MEMBER ROLE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkCompanyName = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Company name is required" });
        }

        const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingCompany = await org.companies.findOne({ name: new RegExp(`^${escaped}$`, 'i') }, { admins: false });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Company name already taken" : "Company name is available"
        });
    } catch (err) {
        logger.error("CHECK COMPANY NAME ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkCompanyDomain = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) {
            return res.status(400).json({ message: "Domain is required" });
        }

        const existingCompany = await org.companies.findOne({ domain: domain.toLowerCase() }, { admins: false });

        return res.json({
            available: !existingCompany,
            message: existingCompany ? "Domain already registered" : "Domain is available"
        });
    } catch (err) {
        logger.error("CHECK COMPANY DOMAIN ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const existingUser = await identity.users.findByEmail(email.toLowerCase());

        return res.json({
            available: !existingUser,
            message: existingUser ? "Email already in use" : "Email is available"
        });
    } catch (err) {
        logger.error("CHECK EMAIL ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: "Phone is required" });
        }

        const existingUser = await identity.users.findByPhone(phone);
        const existingCompany = await org.companies.findOne({ ownerPhone: phone }, { admins: false });

        return res.json({
            available: !existingUser && !existingCompany,
            message: (existingUser || existingCompany) ? "Phone already registered" : "Phone is available"
        });
    } catch (err) {
        logger.error("CHECK PHONE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.startSetup = async (req, res) => {
    try {
        const { id: companyId } = req.params;
        const userId = req.user.sub;

        const { isAdmin } = await companyService.checkIsAdmin(userId, companyId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only company admins can start setup' });
        }

        const updated = await org.updateCompany(companyId, {
            setupStep: 1,
            'metadata.termsAcceptedAt': new Date(),
            'metadata.termsAcceptedBy': userId
        });

        if (!updated) return res.status(404).json({ message: 'Company not found' });

        return res.json({ message: 'Setup started', company: org.publicCompany(updated, { documents: false }) });
    } catch (err) {
        logger.error('START SETUP ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.handleSetup = (req, res) => {
    
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
            logger.error('HANDLE SETUP ERROR:', err2);
            return res.status(500).json({ message: err2.message || 'Server error' });
        }
    });
};

exports.downloadTemplate = async (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        
        const headers = [
            'First Name',   
            'Last Name',    
            'Email',        
            'Pers. Email',  
            'Job Title',    
            'Join Date',    
            'Mobile',       
            'Corp ID',      
            'Role',         
            'Department'    
        ];
        const samples = [
            ['Aarav',  'Sharma',  'aarav.sharma@example.com',  'aarav.personal@example.com',   'Software Engineer',    '2024-06-10', '9876543210', 'KT1001', 'admin',   'Engineering'],
            ['Neha',   'Reddy',   'neha.reddy@example.com',    'neha.personal@example.com',   'Engineering Manager',  '2023-03-15', '9876543211', 'KT1002', 'manager', 'Engineering'],
            ['Rohan',  'Mehta',   'rohan.mehta@example.com',   'rohan.personal@example.com',    'Engineering Manager',  '2023-07-21', '9876543212', 'KT1003', 'manager', 'Engineering'],
            ['Isha',   'Kapoor',  'isha.kapoor@example.com',   'isha.personal@example.com',    'Backend Engineer',     '2024-01-05', '9876543213', 'KT1004', 'member',  'Engineering'],
            ['Vikram', 'Nair',    'vikram.nair@example.com',   'vikram.personal@example.com', 'Frontend Engineer',    '2024-02-11', '9876543214', 'KT1005', 'member',  'Engineering'],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
        ws['!cols'] = [
            { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 28 },
            { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="oruinwan_team_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
    } catch (err) {
        logger.error('DOWNLOAD TEMPLATE ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
