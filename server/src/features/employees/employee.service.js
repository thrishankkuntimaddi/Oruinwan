const crypto = require('crypto');
const XLSX = require('xlsx');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Workspace = require('../../../models/Workspace');
const Channel = require('../channels/channel.model.js');
const Invite = require('../../../models/Invite');
const sendEmail = require('../../../utils/sendEmail');
const { sha256 } = require('../../../utils/hashUtils');
const { logAction } = require('../../../utils/historyLogger');
const { assignMembers } = require('../departments/department.service');

const VALID_INVITE_ROLES = ['admin', 'manager', 'member', 'guest'];

const _bulkJobs = new Map();
const JOB_TTL_MS = 2 * 60 * 60 * 1000; 

function _makeJobId() {
    return `bjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function _createJob(jobId, companyId, total) {
    const job = {
        jobId,
        companyId: companyId.toString(),
        status: 'processing',
        total,
        processed: 0,
        created: 0,
        skipped: 0,
        errors: [],
        warnings: [],
        startedAt: new Date(),
        completedAt: null,
    };
    _bulkJobs.set(jobId, job);
    
    setTimeout(() => _bulkJobs.delete(jobId), JOB_TTL_MS);
    return job;
}

function getBulkJobStatus(jobId, companyId) {
    const job = _bulkJobs.get(jobId);
    if (!job || job.companyId !== companyId.toString()) return null;
    return { ...job }; 
}

async function _createInviteRecord({ companyId, email, role, invitedBy, departmentIds = [], workspaceId }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);

    const invite = new Invite({
        email: email.toLowerCase(),
        tokenHash,
        company: companyId,
        workspace: workspaceId || null,
        role,
        invitedBy,
        
        department: departmentIds?.[0] || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
    });

    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;
    return { invite, inviteLink, rawToken };
}

async function _sendInviteEmail(email, companyName, inviteLink, name = '') {
    try {
        await sendEmail({
            to: email,
            subject: `You're invited to join ${companyName} on Chttrix`,
            html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
  <h2 style="color:#4f46e5">${name ? `Hi ${name},` : "You've been invited!"}</h2>
  <p>You've been invited to join <strong>${companyName}</strong> on Chttrix.</p>
  <p style="margin:24px 0">
    <a href="${inviteLink}"
       style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">
      Accept Invitation &amp; Set Password
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you did not expect this invite, you can ignore it.</p>
</div>`,
        });
        return { sent: true };
    } catch (err) {
        console.warn('[INVITE] Email send failed:', err.message);
        return { sent: false, reason: err.message };
    }
}

async function inviteEmployee(params) {
    const {
        companyId,
        email,
        firstName = '',
        lastName = '',
        role = 'member',
        departmentIds = [],
        additionalWorkspaceIds = [],
        jobTitle,
        joiningDate,
        invitedBy,
        req,
    } = params;

    const company = await Company.findById(companyId);
    if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

    const normalizedEmail = email.toLowerCase().trim();

    
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
        if (existingUser.accountStatus === 'active') {
            throw Object.assign(new Error('A user with this email is already active on the platform.'), { status: 409 });
        }
        if (existingUser.companyId && existingUser.companyId.toString() !== companyId.toString()) {
            throw Object.assign(new Error('This email is already associated with a different company.'), { status: 409 });
        }
    }

    
    const { invite, inviteLink } = await _createInviteRecord({
        companyId,
        email: normalizedEmail,
        role,
        invitedBy,
        departmentIds,
        workspaceId: company.defaultWorkspace || null,
    });

    
    const name = [firstName, lastName].filter(Boolean).join(' ');
    const emailResult = await _sendInviteEmail(normalizedEmail, company.name, inviteLink, name);

    
    
    
    
    

    
    invite.metadata = {
        ...(invite.metadata || {}),
        firstName,
        lastName,
        jobTitle: jobTitle || null,
        joiningDate: joiningDate || null,
        departmentIds,
        additionalWorkspaceIds,
        emailSent: emailResult.sent,
    };
    await invite.save();

    try {
        await logAction({
            userId: invitedBy,
            action: 'employee_invited',
            description: `Invited ${normalizedEmail} as ${role}`,
            resourceType: 'invite',
            resourceId: invite._id,
            companyId,
            metadata: { email: normalizedEmail, role, departmentIds },
            req,
        });
    } catch {  }

    return {
        inviteId: invite._id,
        emailSent: emailResult.sent,
        
    };
}

function _parseEmployeeFile(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    return rows
        .slice(1) 
        .filter(r => r[2] || r[1]) 
        .map(r => {
            const isNewFormat = String(r[2] || '').includes('@');
            if (isNewFormat) {
                return {
                    firstName: String(r[0] || '').trim(),
                    lastName: String(r[1] || '').trim(),
                    email: String(r[2] || '').trim().toLowerCase(),
                    phone: String(r[6] || '').trim(),
                    role: String(r[8] || 'member').trim().toLowerCase(),
                    department: String(r[9] || '').trim(),
                    jobTitle: String(r[4] || '').trim(),
                };
            }
            
            return {
                firstName: String(r[0] || '').trim(),
                lastName: '',
                email: String(r[1] || '').trim().toLowerCase(),
                phone: String(r[2] || '').trim(),
                role: String(r[3] || 'member').trim().toLowerCase(),
                department: String(r[4] || '').trim(),
            };
        })
        .filter(e => e.email);
}

const _delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function bulkOnboardEmployees({ companyId, requesterRole, fileBuffer, invitedBy, req }) {
    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

    
    const { default: Department } = await import('../../../models/Department.js').catch(() =>
        ({ default: require('../../../models/Department') })
    );
    const depts = await Department.find({ company: companyId, isActive: true }).select('_id name').lean();
    const deptNameMap = new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));

    
    const rows = _parseEmployeeFile(fileBuffer);

    if (rows.length === 0) {
        throw Object.assign(new Error('No valid rows found in the uploaded file.'), { status: 400 });
    }

    if (rows.length > 500) {
        throw Object.assign(new Error('Maximum 500 employees per bulk import. Split your file into smaller batches.'), { status: 400 });
    }

    
    const seenEmails = new Set();
    const warnings = [];
    const dedupedRows = [];
    for (const row of rows) {
        if (seenEmails.has(row.email)) {
            warnings.push({ email: row.email, warning: 'Duplicate email in file — skipped second occurrence' });
        } else {
            seenEmails.add(row.email);
            dedupedRows.push(row);
        }
    }

    const jobId = _makeJobId();
    const job = _createJob(jobId, companyId, dedupedRows.length);
    job.warnings.push(...warnings);

    
    setImmediate(async () => {
        const BATCH_SIZE = 20;
        const BATCH_DELAY = 200; 

        for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
            const batch = dedupedRows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    
                    if (!VALID_INVITE_ROLES.includes(row.role)) {
                        row.role = 'member';
                        job.warnings.push({ email: row.email, warning: `Invalid role '${row.role}' — defaulted to member` });
                    }

                    
                    const departmentIds = [];
                    if (row.department) {
                        const deptId = deptNameMap.get(row.department.toLowerCase().trim());
                        if (deptId) {
                            departmentIds.push(deptId);
                        } else {
                            job.warnings.push({ email: row.email, warning: `Department '${row.department}' not found — skipped dept assignment` });
                        }
                    }

                    
                    await inviteEmployee({
                        companyId,
                        email: row.email,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        role: row.role,
                        departmentIds,
                        jobTitle: row.jobTitle,
                        invitedBy,
                        req,
                    });

                    job.created++;
                } catch (err) {
                    
                    job.errors.push({ email: row.email, error: err.message });
                    job.skipped++;
                } finally {
                    job.processed++;
                }
            }

            
            if (i + BATCH_SIZE < dedupedRows.length) {
                await _delay(BATCH_DELAY);
            }
        }

        job.status = 'done';
        job.completedAt = new Date();

        try {
            await logAction({
                userId: invitedBy,
                action: 'bulk_onboarding_complete',
                description: `Bulk import: ${job.created} created, ${job.skipped} skipped`,
                resourceType: 'company',
                resourceId: companyId,
                companyId,
                metadata: { total: dedupedRows.length, created: job.created, skipped: job.skipped },
                req,
            });
        } catch {  }
    });
    

    return { jobId, total: dedupedRows.length };
}

async function resendInvite({ userId, companyId, req }) {
    const user = await User.findOne({ _id: userId, companyId, accountStatus: 'invited' }).lean();
    if (!user) throw Object.assign(new Error('User not found or no longer pending.'), { status: 404 });

    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

    
    await Invite.updateMany(
        { email: user.email, company: companyId, acceptedAt: null },
        { $set: { expiresAt: new Date() } } 
    );

    
    const { invite, inviteLink } = await _createInviteRecord({
        companyId,
        email: user.email,
        role: user.companyRole || 'member',
        invitedBy: req?.user?._dbUser?._id || null,
    });

    const name = user.username || user.email;
    await _sendInviteEmail(user.email, company.name, inviteLink, name);

    return { inviteId: invite._id, email: user.email };
}

module.exports = {
    
    inviteEmployee,

    
    bulkOnboardEmployees,
    getBulkJobStatus,

    
    resendInvite,

    
    _createInviteRecord,
    _sendInviteEmail,
};
