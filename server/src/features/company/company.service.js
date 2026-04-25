const Company = require('../../../models/Company');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const { logAction } = require('../../../utils/historyLogger');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const { uploadToGCS } = require('../../modules/uploads/upload.service');

async function getCompanyById(companyId) {
    const company = await Company.findById(companyId)
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name')
        .populate({
            path: 'departments',
            select: 'name head memberCount',
            populate: {
                path: 'head',
                select: 'username email'
            }
        });

    return company;
}

async function checkUserAccess(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { hasAccess: false, user: null };
    }

    
    const hasAccess = !user.companyId || user.companyId.toString() === companyId;

    return { hasAccess, user };
}

async function checkIsAdmin(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { isAdmin: false, user: null };
    }

    const isAdmin = user.companyId &&
        user.companyId.toString() === companyId &&
        (user.companyRole === 'owner' || user.companyRole === 'admin');

    return { isAdmin, user };
}

async function updateCompany(companyId, updates) {
    const company = await Company.findByIdAndUpdate(
        companyId,
        { $set: updates },
        { new: true, runValidators: true }
    )
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name');

    return company;
}

async function getCompanyMembers(companyId) {
    const members = await User.find({
        companyId,
        accountStatus: { $ne: 'removed' }, 
    })
        .select([
            'username', 'email', 'companyEmail',  
            'profilePicture', 'companyRole',
            'jobTitle', 'phone', 'corporateId',
            'accountStatus', 'createdAt', 'lastLoginAt', 'isOnline',
            'departments', 'workspaces'
        ].join(' '))
        .populate('departments', 'name')
        .populate('workspaces.workspace', 'name')
        .lean();

    return members;
}

async function getCompanyMetrics(companyId) {
    
    const [totalUsers, activeUsers, totalWorkspaces, totalDepartments] = await Promise.all([
        User.countDocuments({ companyId }),
        User.countDocuments({ companyId, isOnline: true }),
        Workspace.countDocuments({ company: companyId }),
        Department.countDocuments({ company: companyId })
    ]);

    return {
        totalUsers,
        activeUsers,
        totalWorkspaces,
        totalDepartments
    };
}

async function updateMemberRole({ companyId, targetUserId, requesterId, newRole, req }) {
    const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];

    if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role');
    }

    
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    
    if (!company.isAdmin(requesterId)) {
        throw new Error('Only company admins can change roles');
    }

    
    const requester = await User.findById(requesterId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
        throw new Error('User not found');
    }

    if (targetUser.companyId.toString() !== companyId) {
        throw new Error('User does not belong to this company');
    }

    
    if (newRole === 'owner' && requester.companyRole !== 'owner') {
        throw new Error('Only owners can assign owner role');
    }

    
    const oldRole = targetUser.companyRole;

    
    targetUser.companyRole = newRole;
    await targetUser.save();

    
    if (newRole === 'owner' || newRole === 'admin') {
        const existingAdmin = company.admins.find(
            a => a.user.toString() === targetUserId
        );
        if (!existingAdmin) {
            company.admins.push({ user: targetUserId, role: newRole });
            await company.save();
        }
    } else {
        
        company.admins = company.admins.filter(
            a => a.user.toString() !== targetUserId
        );
        await company.save();
    }

    
    await logAction({
        userId: requesterId,
        action: 'user_role_changed',
        description: `Changed ${targetUser.username}'s role to ${newRole}`,
        resourceType: 'user',
        resourceId: targetUserId,
        companyId,
        metadata: { oldRole, newRole },
        req
    });

    return {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        companyRole: targetUser.companyRole
    };
}

module.exports = {
    getCompanyById,
    checkUserAccess,
    checkIsAdmin,
    updateCompany,
    getCompanyMembers,
    getCompanyMetrics,
    updateMemberRole,
    processSetupStep,
    bulkInviteEmployees
};

async function processSetupStep({ companyId, userId, step, data, files }) {
    const company = await Company.findById(companyId);
    if (!company) throw new Error('Company not found');

    switch (step) {
        case 1: {
            
            const updates = {};
            if (data.displayName) updates.displayName = data.displayName;
            if (data.timezone) updates['settings.timezone'] = data.timezone;

            
            if (files.logo && files.logo[0]) {
                const logoFile = files.logo[0];
                const gcsResult = await uploadToGCS(logoFile, `company-logos/${companyId}`);
                updates['settings.logo'] = gcsResult.url;
                updates.logo = gcsResult.url;
            }

            updates.setupStep = 2;
            await Company.findByIdAndUpdate(companyId, { $set: updates });
            return { message: 'Step 1 saved', nextStep: 2 };
        }

        case 2: {
            
            const deptNames = data.departments || [];

            
            await Department.deleteMany({ company: companyId });

            
            const createdDepts = await Promise.all(
                deptNames.map(name =>
                    Department.create({ name, company: companyId })
                )
            );

            await Company.findByIdAndUpdate(companyId, {
                $set: {
                    departments: createdDepts.map(d => d._id),
                    setupStep: 3
                }
            });

            return { message: 'Departments saved', departments: createdDepts, nextStep: 3 };
        }

        case 3: {
            
            let employees = [];

            if (files.employeeFile && files.employeeFile[0]) {
                
                const wb = XLSX.read(files.employeeFile[0].buffer, { type: 'buffer' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const dataRows = rows.slice(1).filter(r => r[2] || r[1]); 

                employees = dataRows.map(r => {
                    
                    
                    
                    
                    const isNewFormat = String(r[2] || '').includes('@');
                    if (isNewFormat) {
                        return {
                            name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                            companyEmail: String(r[2] || '').trim().toLowerCase(),  
                            personalEmail: String(r[3] || '').trim().toLowerCase(), 
                            jobTitle: String(r[4] || '').trim(),
                            joiningDate: String(r[5] || '').trim(),
                            phone: String(r[6] || '').trim(),
                            corporateId: String(r[7] || '').trim(),
                            role: String(r[8] || 'member').trim().toLowerCase(),
                            department: String(r[9] || '').trim(),
                        };
                    }
                    
                    return {
                        name: String(r[0] || '').trim(),
                        companyEmail: String(r[1] || '').trim().toLowerCase(),
                        personalEmail: '',
                        phone: String(r[2] || '').trim(),
                        role: String(r[3] || 'member').trim().toLowerCase(),
                        department: String(r[4] || '').trim(),
                    };
                }).filter(e => e.companyEmail);

                
                const company = await Company.findById(companyId);
                if (company?.domain) {
                    employees = employees.map(e => ({
                        ...e,
                        
                        domainMismatch: !e.companyEmail.endsWith(`@${company.domain}`)
                    }));
                }
            } else if (data.invites && Array.isArray(data.invites)) {
                employees = data.invites.filter(i => i.email);
            }

            let results = { created: 0, skipped: 0, errors: [] };
            if (employees.length > 0) {
                results = await bulkInviteEmployees(companyId, company.domain, employees);
            }

            await Company.findByIdAndUpdate(companyId, { $set: { setupStep: 4 } });
            return { message: 'Invites processed', results, nextStep: 4 };
        }

        case 4: {
            
            await Company.findByIdAndUpdate(companyId, {
                $set: { isSetupComplete: true, setupStep: 4 }
            });
            
            await User.findByIdAndUpdate(userId, {
                $set: { 'companyStatus': 'active' }
            });
            return {
                message: 'Setup complete! Workspace launched.',
                redirectTo: '/admin/analytics',
                nextStep: null
            };
        }

        default:
            throw new Error('Invalid setup step');
    }
}

async function bulkInviteEmployees(companyId, companyDomain, employees) {
    const results = { created: 0, skipped: 0, errors: [] };

    const company = await Company.findById(companyId).populate('departments', 'name _id');

    
    const deptMap = {};
    (company.departments || []).forEach(d => {
        deptMap[d.name.toLowerCase()] = d._id;
    });

    for (const emp of employees) {
        try {
            
            
            const companyEmailVal = emp.companyEmail || emp.email || '';
            const loginEmail = (emp.personalEmail || companyEmailVal).toLowerCase();
            const credentialEmail = emp.personalEmail || companyEmailVal; 

            if (!companyEmailVal && !loginEmail) {
                results.errors.push({ name: emp.name, error: 'No email provided' });
                continue;
            }

            
            const existingUser = await User.findOne({
                $or: [
                    { companyEmail: companyEmailVal },
                    { email: loginEmail },
                    { email: companyEmailVal }
                ]
            });
            if (existingUser) {
                results.skipped++;
                continue;
            }

            
            const tempPassword = generateTempPassword();
            const hashedPw = await bcrypt.hash(tempPassword, 10);

            
            const deptId = deptMap[emp.department?.toLowerCase()] || null;

            
            const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];
            const companyRole = validRoles.includes(emp.role) ? emp.role : 'member';

            
            const namePart = (emp.name || companyEmailVal.split('@')[0])
                .toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
            const username = `${namePart}_${Math.random().toString(36).slice(2, 6)}`;

            
            
            
            const newUser = await User.create({
                username,
                email: loginEmail,                       
                companyEmail: companyEmailVal,           
                phone: emp.phone || undefined,
                jobTitle: emp.jobTitle || undefined,
                corporateId: emp.corporateId || undefined,
                passwordHash: hashedPw,
                userType: 'company',
                companyId,
                companyRole,
                departments: deptId ? [deptId] : [],
                verified: true,
                accountStatus: 'active',
            });

            
            await sendWelcomeEmail({
                to: credentialEmail,
                name: emp.name || username,
                companyName: company.name,
                companyEmail: companyEmailVal,  
                loginEmail,
                tempPassword
            });

            results.created++;
        } catch (err) {
            results.errors.push({ name: emp.name, error: err.message });
        }
    }

    return results;
}

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

async function sendWelcomeEmail({ to, name, companyName, companyEmail, loginEmail, tempPassword }) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: `"${companyName} via Chttrix" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
            to,
            subject: `You're invited to join ${companyName} on Chttrix`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
                    <div style="background: white; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0;">
                        <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 8px;">Welcome to ${companyName}! 🎉</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">Hi ${name}, your account has been set up on Chttrix.</p>

                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Your Login Details</p>
                            ${companyEmail ? `<p style="margin: 4px 0; color: #1e293b;"><strong>Work Email:</strong> ${companyEmail}</p>` : ''}
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Login Email:</strong> ${loginEmail || to}</p>
                            <p style="margin: 4px 0; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; letter-spacing: 0.1em;">${tempPassword}</code></p>
                        </div>

                        <p style="color: #64748b; font-size: 14px;">⚠️ Please change your password immediately after your first login.</p>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                           style="display: inline-block; margin-top: 20px; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Login to Chttrix →
                        </a>

                        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">This invitation was sent by ${companyName}. If you believe this was a mistake, please ignore this email.</p>
                    </div>
                </div>
            `
        });
    } catch (err) {
        console.error('[WELCOME EMAIL] Failed to send to', to, ':', err.message);
        
    }
}
