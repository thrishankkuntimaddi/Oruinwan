// server/src/features/onboarding/onboarding.controller.js
//
// Phase 1 — Company Identity Layer Stabilization
//
// Thin HTTP layer. All business logic lives in the three service modules:
//   onboarding.service.js  — individual flow (role ceiling, dept validation, user creation)
//   bulkImport.service.js  — async batch job engine
//   invite.service.js      — token lifecycle, accept, resend

const { body, validationResult } = require('express-validator');
const { onboardIndividual } = require('./onboarding.service');
const { startBulkJob, getJobStatus } = require('./bulkImport.service');
const { resendInvite, acceptInvite } = require('./invite.service');

// ============================================================================
// VALIDATION RULES
// ============================================================================

exports.validateIndividual = [
    body('email')
        .isEmail().withMessage('Valid email required')
        .normalizeEmail(),
    body('firstName')
        .notEmpty().trim().withMessage('First name required'),
    body('lastName')
        .optional().trim(),
    body('companyRole')
        .isIn(['admin', 'manager', 'member', 'guest'])
        .withMessage('companyRole must be admin, manager, member, or guest'),
    body('departmentIds')
        .optional()
        .isArray().withMessage('departmentIds must be an array'),
    body('additionalWorkspaceIds')
        .optional()
        .isArray().withMessage('additionalWorkspaceIds must be an array'),
];

exports.validateAcceptInvite = [
    body('token').notEmpty().withMessage('Invite token required'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// ============================================================================
// ERROR HELPER
// ============================================================================

function handleError(res, err) {
    console.error('[ONBOARDING CTRL]', err.message);
    return res.status(err.status || 500).json({
        success: false,
        error: err.message,
        code: err.code || undefined,
    });
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * POST /api/company/onboarding/individual
 *
 * Creates a single user with accountStatus:'invited' and sends a magic-link email.
 * Role ceiling enforced by onboarding.service.onboardIndividual().
 * Department assignment via department.service.assignMembers() (Phase 4).
 */
exports.inviteIndividual = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }

    try {
        const {
            email,
            firstName,
            lastName = '',
            companyRole = 'member',
            departmentIds = [],
            additionalWorkspaceIds = [],
            jobTitle,
            joiningDate,
        } = req.body;

        const result = await onboardIndividual({
            companyId: req.companyId,       // set by requireCompanyMember
            requesterRole: req.companyRole,     // set by requireCompanyMember
            invitedBy: req.user._dbUser._id,
            email,
            firstName,
            lastName,
            companyRole,
            departmentIds,
            additionalWorkspaceIds,
            jobTitle,
            joiningDate,
        });

        return res.status(201).json({
            success: true,
            message: `Invite sent to ${email}. They will receive a link to set their own password.`,
            userId: result.userId,
            emailSent: result.emailSent,
        });

    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/onboarding/bulk
 *
 * Receives multipart/form-data with `employeeFile` (xlsx/csv).
 * Returns HTTP 202 immediately with { jobId, total }.
 * Processing runs in background — frontend polls GET /status/:jobId.
 */
exports.bulkImport = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded. Attach an .xlsx or .csv file as `employeeFile`.',
        });
    }

    try {
        const { jobId, total, validationErrors } = await startBulkJob({
            companyId: req.companyId,
            requesterRole: req.companyRole,
            fileBuffer: req.file.buffer,
            invitedBy: req.user._dbUser._id,
        });

        return res.status(202).json({
            success: true,
            jobId,
            total,
            status: 'queued',
            message: `Processing ${total} employees in the background.`,
            validationErrors: validationErrors || [], // hard-fails returned now, not async
            pollUrl: `/api/company/onboarding/status/${jobId}`,
        });

    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * GET /api/company/onboarding/status/:jobId
 *
 * Returns current job progress from MongoDB.
 * Company isolation enforced — companyId must match.
 */
exports.getJobStatus = async (req, res) => {
    try {
        const job = await getJobStatus(req.params.jobId, req.companyId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found or does not belong to your company.',
            });
        }

        return res.json({ success: true, job });

    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/onboarding/resend/:userId
 *
 * Regenerates invite token and resends magic-link email.
 * Only works for users with accountStatus:'invited'.
 */
exports.resendInviteEmail = async (req, res) => {
    try {
        const result = await resendInvite(req.params.userId, req.companyId);
        return res.json({
            success: true,
            message: result.sent
                ? 'Invite re-sent successfully.'
                : 'User record updated but email delivery failed — check Brevo logs.',
            emailSent: result.sent,
        });
    } catch (err) {
        return handleError(res, err);
    }
};

/**
 * POST /api/company/onboarding/accept
 *
 * Public endpoint (no auth required) — called when employee clicks the invite link.
 * Validates token, activates account, runs department.service.assignMembers() (Phase 4).
 */
exports.acceptInviteHandler = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }

    try {
        const { token, password } = req.body;
        const { user, alreadyActive } = await acceptInvite(token, password);

        return res.json({
            success: true,
            alreadyActive,
            message: alreadyActive
                ? 'Account is already active. Please log in.'
                : 'Account activated! You can now log in with your new password.',
            user,
        });

    } catch (err) {
        return handleError(res, err);
    }
};
