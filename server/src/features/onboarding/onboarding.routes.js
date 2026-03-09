// server/src/features/onboarding/onboarding.routes.js
//
// Phase 1 — Company Identity Layer Stabilization
//
// Middleware chain (all gated routes):
//   requireAuth → requireCompanyMember → requireCompanyRole('admin')
//
// Exception: POST /accept is public (token is the credential).
//
// Route table:
//   POST   /individual           — token invite for one employee
//   POST   /bulk                 — xlsx/csv upload → async job (HTTP 202)
//   GET    /status/:jobId        — poll async bulk job progress
//   POST   /resend/:userId       — re-send invite for pending user
//   POST   /accept               — public: validate token, activate account
//   GET    /template             — redirect to xlsx template

const express = require('express');
const multer = require('multer');
const router = express.Router();

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const ctrl = require('./onboarding.controller');

// ── multer — memory storage, file type guard, 10 MB cap ──────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname) ||
            [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'text/csv',
                'application/csv',
            ].includes(file.mimetype);
        cb(ok ? null : new Error('Only .xlsx, .xls, and .csv files are accepted.'), ok);
    },
});

// Shared middleware chain for all protected routes
const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

// ============================================================================
// PROTECTED ROUTES (admin or owner only)
// ============================================================================

/**
 * @route  POST /api/company/onboarding/individual
 * @desc   Invite a single employee — token email, no passwords
 * @access admin / owner
 */
router.post('/individual', ...gate, ctrl.validateIndividual, ctrl.inviteIndividual);

/**
 * @route  POST /api/company/onboarding/bulk
 * @desc   Upload employee spreadsheet → async job → returns { jobId }
 * @access admin / owner
 */
router.post('/bulk', ...gate, upload.single('employeeFile'), ctrl.bulkImport);

/**
 * @route  GET /api/company/onboarding/status/:jobId
 * @desc   Poll async bulk import job status
 * @access admin / owner
 */
router.get('/status/:jobId', ...gate, ctrl.getJobStatus);

/**
 * @route  POST /api/company/onboarding/resend/:userId
 * @desc   Regenerate invite token + resend email for 'invited' user
 * @access admin / owner
 */
router.post('/resend/:userId', ...gate, ctrl.resendInviteEmail);

/**
 * @route  GET /api/company/onboarding/template
 * @desc   Download xlsx template — proxies to the existing setup template route
 * @access admin / owner
 */
router.get('/template', ...gate, (req, res) => {
    return res.redirect(`/api/companies/${req.companyId}/setup/template`);
});

// ============================================================================
// PUBLIC ROUTE — no authentication required
// ============================================================================

/**
 * @route  POST /api/company/onboarding/accept
 * @desc   Accept invite token, set password, activate account
 * @access Public — the invite token IS the credential
 * @body   { token: string, password: string }
 */
router.post('/accept', ctrl.validateAcceptInvite, ctrl.acceptInviteHandler);

module.exports = router;
