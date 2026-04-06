// server/src/features/onboarding/invite.service.js
//
// Phase 1 — Company Identity Layer
//
// Responsibilities:
//   createInviteToken(user)      — generate token, hash it onto User, set 72h expiry
//   sendInviteEmail(...)         — send magic-link email (no passwords ever)
//   acceptInvite(token, password)— validate token, activate user, call assignMembers
//   resendInvite(userId, ...)    — invalidate old token, issue fresh one

const crypto = require('crypto');
const User = require('../../../models/User');
const sendEmail = require('../../../utils/sendEmail');
const { inviteTemplate } = require('../../../utils/emailTemplates');

// INVITE_EXPIRY_MS — 72 hours as per spec
const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000;

/**
 * SHA-256 a string — deterministic, no salt needed for tokens.
 */
function _sha256(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// ============================================================================
// CREATE TOKEN
// ============================================================================

/**
 * Generate a 64-char hex invite token, hash it, store on the user document.
 * Returns the RAW (unhashed) token — this is the only time it exists in plaintext.
 * The raw token goes into the email link only; the hash is stored in the DB.
 *
 * @param   {mongoose.Document} user  — must be a Mongoose document (not .lean())
 * @returns {string}                  — raw 64-char hex token (for email link only)
 */
async function createInviteToken(user) {
    const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = _sha256(rawToken);

    user.inviteToken = tokenHash;
    user.inviteTokenExpiry = new Date(Date.now() + INVITE_EXPIRY_MS);
    user.inviteEmailStatus = 'pending';

    await user.save();
    return rawToken; // caller puts this in the email link ONLY
}

// ============================================================================
// SEND EMAIL
// ============================================================================

/**
 * Send a styled invite email carrying the magic link.
 * Absolutely no password, no credentials, no temporary secrets in the email body.
 *
 * @param {string} toEmail
 * @param {string} companyName
 * @param {string} rawToken      — the unhashed invite token
 * @param {Object} [options]     — { name, jobTitle }
 * @returns {{ sent: boolean, reason?: string }}
 */
async function sendInviteEmail(toEmail, companyName, rawToken, options = {}) {
    const { name = '', jobTitle = '' } = options;

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${rawToken}`;
    const tpl = inviteTemplate(name, companyName, inviteLink, { jobTitle });
    try {
        await sendEmail({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
        return { sent: true };
    } catch (err) {
        console.warn('[INVITE] Email failed for', toEmail, '—', err.message);
        return { sent: false, reason: err.message };
    }
}

// ============================================================================
// ACCEPT INVITE
// ============================================================================

/**
 * Validate invite token and activate the user account with a password they set.
 *
 * Steps:
 *   1. Hash the incoming raw token
 *   2. Find user by hash + expiry guard
 *   3. Set passwordHash, accountStatus:'active', clear invite fields
 *   4. Call department.service.assignMembers() for each pending department
 *      (stored in user.departments[] when the invite was created)
 *
 * @param {string} rawToken  — from URL query param
 * @param {string} password  — plain text from the Accept form (min 8 chars)
 * @returns {Promise<{ user: Object, alreadyActive: boolean }>}
 */
async function acceptInvite(rawToken, password) {
    if (!rawToken || !password) {
        throw Object.assign(new Error('Token and password are required.'), { status: 400 });
    }
    if (password.length < 8) {
        throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 400 });
    }

    const tokenHash = _sha256(rawToken);

    const user = await User.findOne({
        inviteToken: tokenHash,
        inviteTokenExpiry: { $gt: new Date() },  // not yet expired
    });

    if (!user) {
        throw Object.assign(new Error('Invalid or expired invite link. Please ask your admin to resend the invite.'), { status: 400 });
    }

    if (user.accountStatus === 'active') {
        // S-11 SECURITY FIX: Unconditionally clear invite token even on the already-active
        // path — prevents token re-use if a race condition or alternate activation path
        // left the token populated without clearing it.
        if (user.inviteToken || user.inviteTokenExpiry) {
            user.inviteToken = null;
            user.inviteTokenExpiry = null;
            await user.save();
        }
        // Idempotent — already activated (double-click, etc.)
        return { user: _safeUser(user), alreadyActive: true };
    }

    // bcrypt is required for hashing
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    // Activate account
    user.passwordHash = passwordHash;
    user.accountStatus = 'active';
    user.verified = true;
    user.inviteToken = null;
    user.inviteTokenExpiry = null;
    user.inviteEmailStatus = 'accepted';

    await user.save();

    // Phase 3 — Security: log invite acceptance (non-blocking)
    if (user.companyId) {
        const { logSecurityEvent } = require('../security/security.service');
        logSecurityEvent({
            companyId: user.companyId,
            actorId: user._id,
            eventType: 'invite_accepted',
            outcome: 'success',
            metadata: { email: user.email },
        });
    }

    // FIX-3: trigger department.service.assignMembers() so Phase 4 workspace join fires

    // departments[] were stored on the user record at invite creation time
    if (user.departments && user.departments.length > 0 && user.companyId) {
        try {
            const { assignMembers } = require('../departments/department.service');
            await assignMembers(
                user.departments[0].toString(), // primary department
                user.companyId.toString(),
                [user._id.toString()],
                'add'
            );
            // For additional departments (if multiple), iterate
            for (let i = 1; i < user.departments.length; i++) {
                await assignMembers(
                    user.departments[i].toString(),
                    user.companyId.toString(),
                    [user._id.toString()],
                    'add'
                );
            }
        } catch (err) {
            // Non-fatal: user is activated, department join can be retried
            console.warn('[INVITE] assignMembers failed on acceptance:', err.message);
        }
    }

    return { user: _safeUser(user), alreadyActive: false };
}

// ============================================================================
// RESEND INVITE
// ============================================================================

/**
 * Invalidate the existing invite token and issue a fresh one.
 * Only works for users with accountStatus: 'invited'.
 *
 * @param {string} userId
 * @param {string} companyId     — for scope isolation
 * @returns {Promise<{ sent: boolean }>}
 */
async function resendInvite(userId, companyId) {
    const user = await User.findOne({
        _id: userId,
        companyId,
        accountStatus: 'invited',
    });

    if (!user) {
        throw Object.assign(
            new Error('User not found or already active. Only pending invites can be resent.'),
            { status: 404 }
        );
    }

    // Require Company for the name
    const Company = require('../../../models/Company');
    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found.'), { status: 404 });

    // Issue fresh token (overwrites old one atomically via save())
    const rawToken = await createInviteToken(user);

    const emailResult = await sendInviteEmail(user.email, company.name, rawToken, {
        name: user.username || '',
        jobTitle: user.jobTitle || '',
    });

    // Update email status on the user record
    user.inviteEmailStatus = emailResult.sent ? 'sent' : 'failed';
    await user.save();

    return { sent: emailResult.sent };
}

// ============================================================================
// HELPERS
// ============================================================================

function _safeUser(user) {
    return {
        _id: user._id,
        username: user.username,
        email: user.email,
        companyRole: user.companyRole,
        accountStatus: user.accountStatus,
    };
}

module.exports = {
    createInviteToken,
    sendInviteEmail,
    acceptInvite,
    resendInvite,
    _sha256, // exported for testing
};
