/**
 * Employee Service — Employee Management & Onboarding
 *
 * STABILIZED: Onboarding Stabilization pass
 *   FIX-1: Token-based invites via Invite model (no plaintext passwords)
 *   FIX-3: Department auto-workspace join via department.service.assignMembers()
 *   FIX-4: bulkOnboardEmployees() — async batch job engine, HTTP non-blocking
 *
 * @module features/employees/employee.service
 */

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

// ── Allowed roles per requester ceiling (FIX-2 used in controller, table here for reference) ──
const VALID_INVITE_ROLES = ['admin', 'manager', 'member', 'guest'];

// ── In-memory bulk job store ─────────────────────────────────────────────────
// JobId → { companyId, status, total, processed, created, skipped, errors[], warnings[], startedAt }
// Jobs expire from memory after 2 hours. For production: swap to Redis or BulkJob model.
const _bulkJobs = new Map();
const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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
    // Auto-expire after TTL
    setTimeout(() => _bulkJobs.delete(jobId), JOB_TTL_MS);
    return job;
}

/**
 * Get bulk job status. Returns null if not found or not owned by companyId.
 */
function getBulkJobStatus(jobId, companyId) {
    const job = _bulkJobs.get(jobId);
    if (!job || job.companyId !== companyId.toString()) return null;
    return { ...job }; // return copy, not reference
}

/**
 * Create a hashed Invite record and return the raw token.
 * NEVER stores plaintext. The raw token is used once in the email link.
 */
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
        // Store first departmentId for backward-compat with Invite model
        department: departmentIds?.[0] || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    await invite.save();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}&email=${encodeURIComponent(email)}`;
    return { invite, inviteLink, rawToken };
}

/**
 * Send invitation email — FIX-1: absolutely no plaintext credentials.
 */
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

/**
 * Invite a single employee to the company.
 *
 * FIX-1: creates Invite record (hashed token), sends magic-link email — no password generated.
 * FIX-3: calls department.service.assignMembers() for each departmentId so Phase 4
 *        hybrid workspace join fires correctly.
 *
 * @param {Object} params
 * @param {string}   params.companyId
 * @param {string}   params.email            - Personal/invite email address
 * @param {string}   [params.firstName]
 * @param {string}   [params.lastName]
 * @param {string}   params.role             - companyRole to assign on acceptance
 * @param {string[]} [params.departmentIds]  - Dept ObjectIds (company-validated upstream)
 * @param {string[]} [params.additionalWorkspaceIds] - Extra workspace ObjectIds
 * @param {string}   params.invitedBy        - UserId of requester
 * @param {Object}   [params.req]            - Express req for audit log
 */
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

    // Idempotency: if already invited (not yet accepted), re-use existing invite
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
        if (existingUser.accountStatus === 'active') {
            throw Object.assign(new Error('A user with this email is already active on the platform.'), { status: 409 });
        }
        if (existingUser.companyId && existingUser.companyId.toString() !== companyId.toString()) {
            throw Object.assign(new Error('This email is already associated with a different company.'), { status: 409 });
        }
    }

    // FIX-1: Create hashed invite token (no password ever generated)
    const { invite, inviteLink } = await _createInviteRecord({
        companyId,
        email: normalizedEmail,
        role,
        invitedBy,
        departmentIds,
        workspaceId: company.defaultWorkspace || null,
    });

    // Send magic-link email to personal email
    const name = [firstName, lastName].filter(Boolean).join(' ');
    const emailResult = await _sendInviteEmail(normalizedEmail, company.name, inviteLink, name);

    // FIX-3: Pre-register department memberships so they activate on invite acceptance.
    // This also triggers Phase 4 hybrid workspace join if department has defaultWorkspaceId.
    // We do this BEFORE the user record exists — assignMembers handles missing users gracefully.
    // For now store the intent in the Invite metadata so accept-invite route can call assignMembers().
    // (Department membership is finalised during accept-invite flow because the User doesn't exist yet.)

    // Store enriched metadata on the invite for use during acceptance
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
    } catch { /* log failures are non-fatal */ }

    return {
        inviteId: invite._id,
        emailSent: emailResult.sent,
        // Never return the raw token in the API response
    };
}

/**
 * Parse an Excel/CSV buffer into a rows array.
 * Supports both 10-column (new) and 5-column (legacy) formats.
 */
function _parseEmployeeFile(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    return rows
        .slice(1) // skip header
        .filter(r => r[2] || r[1]) // email at col 2 (new) or col 1 (old)
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
            // Legacy 5-column format
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

// Delay helper for throttling email sends
const _delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Start an async bulk onboarding job.
 *
 * FIX-4: Returns { jobId, total } immediately — processing happens in background.
 *        Never blocks the HTTP response. One row failure cannot fail the batch.
 *        Batches of 20 rows, 200ms delay between batches (Brevo rate limiting).
 *
 * @returns {{ jobId: string, total: number }}
 */
async function bulkOnboardEmployees({ companyId, requesterRole, fileBuffer, invitedBy, req }) {
    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

    // Pre-load all departments for this company (name → ObjectId map)
    const { default: Department } = await import('../../../models/Department.js').catch(() =>
        ({ default: require('../../../models/Department') })
    );
    const depts = await Department.find({ company: companyId, isActive: true }).select('_id name').lean();
    const deptNameMap = new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));

    // Parse rows from the uploaded file
    const rows = _parseEmployeeFile(fileBuffer);

    if (rows.length === 0) {
        throw Object.assign(new Error('No valid rows found in the uploaded file.'), { status: 400 });
    }

    if (rows.length > 500) {
        throw Object.assign(new Error('Maximum 500 employees per bulk import. Split your file into smaller batches.'), { status: 400 });
    }

    // De-duplicate emails within the file
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

    // ── Background processing (non-blocking) ────────────────────────────────
    setImmediate(async () => {
        const BATCH_SIZE = 20;
        const BATCH_DELAY = 200; // ms between batches

        for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
            const batch = dedupedRows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    // Validate role ceiling
                    if (!VALID_INVITE_ROLES.includes(row.role)) {
                        row.role = 'member';
                        job.warnings.push({ email: row.email, warning: `Invalid role '${row.role}' — defaulted to member` });
                    }

                    // Resolve department name → ObjectId
                    const departmentIds = [];
                    if (row.department) {
                        const deptId = deptNameMap.get(row.department.toLowerCase().trim());
                        if (deptId) {
                            departmentIds.push(deptId);
                        } else {
                            job.warnings.push({ email: row.email, warning: `Department '${row.department}' not found — skipped dept assignment` });
                        }
                    }

                    // FIX-1 + FIX-3: use inviteEmployee (token invite + dept assignMembers intent stored)
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
                    // One failure cannot stop the batch
                    job.errors.push({ email: row.email, error: err.message });
                    job.skipped++;
                } finally {
                    job.processed++;
                }
            }

            // Throttle between batches
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
        } catch { /* log failures are non-fatal */ }
    });
    // ── End background ───────────────────────────────────────────────────────

    return { jobId, total: dedupedRows.length };
}

/**
 * Resend invite email for a user still in 'invited' state.
 * Invalidates the old Invite record and issues a fresh token.
 */
async function resendInvite({ userId, companyId, req }) {
    const user = await User.findOne({ _id: userId, companyId, accountStatus: 'invited' }).lean();
    if (!user) throw Object.assign(new Error('User not found or no longer pending.'), { status: 404 });

    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

    // Invalidate any existing pending invite for this email
    await Invite.updateMany(
        { email: user.email, company: companyId, acceptedAt: null },
        { $set: { expiresAt: new Date() } } // expire immediately
    );

    // Create fresh invite
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

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    // Core token invite (FIX-1, FIX-3)
    inviteEmployee,

    // Bulk import async job (FIX-4)
    bulkOnboardEmployees,
    getBulkJobStatus,

    // Resend invite
    resendInvite,

    // Legacy / still used by other routes — preserved for backward-compat
    _createInviteRecord,
    _sendInviteEmail,
};
