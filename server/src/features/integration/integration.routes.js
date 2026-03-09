// server/src/features/integration/integration.routes.js
//
// Phase 4 — Enterprise Integration Layer
//
// Two route groups:
//
// A) SCIM provisioning (/api/scim/) — authenticated via SCIM Bearer token
//    POST   /api/scim/users          — provision user
//    GET    /api/scim/users          — list users
//    GET    /api/scim/users/:id      — get user
//    PATCH  /api/scim/users/:id      — update user
//    DELETE /api/scim/users/:id      — deactivate user
//
// B) Admin integration console (/api/company/) — standard auth chain (admin/owner)
//    POST   /api/company/scim/tokens          — issue SCIM bearer token
//    GET    /api/company/scim/tokens          — list tokens
//    DELETE /api/company/scim/tokens/:id      — revoke token
//    POST   /api/company/integrations/sync    — trigger manual HR sync
//    GET    /api/company/integrations/status  — last sync status

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const scim = require('./scim.controller');

// Standard company auth chain
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const { runHrSync } = require('./hr-sync.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

function handleError(res, err) {
    console.error('[INTEGRATION]', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
}

function validationGuard(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    return null;
}

// ── SHARED ADMIN GATE ─────────────────────────────────────────────────────────

const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

// ============================================================================
// A) SCIM PROVISIONING — /api/scim/users
// All routes use SCIM Bearer token auth (scim.scimAuth middleware).
// ============================================================================

router.post('/scim/users', scim.scimAuth, scim.createUser);
router.get('/scim/users', scim.scimAuth, scim.listUsers);
router.get('/scim/users/:id', scim.scimAuth, scim.getUser);
router.patch('/scim/users/:id', scim.scimAuth, scim.updateUser);
router.delete('/scim/users/:id', scim.scimAuth, scim.deactivateUser);

// ============================================================================
// B) ADMIN CONSOLE — /api/company/...
// Standard requireAuth → requireCompanyMember → requireCompanyRole('admin')
// ============================================================================

// ── SCIM Token Management ─────────────────────────────────────────────────────

/**
 * @route   POST /api/company/scim/tokens
 * @desc    Issue a new SCIM bearer token (raw shown once)
 * @access  admin / owner
 * @body    { label?, provider? }
 */
router.post(
    '/company/scim/tokens',
    ...gate,
    [
        body('label').optional().isString().trim(),
        body('provider').optional().isIn(['workday', 'bamboohr', 'rippling', 'generic']),
    ],
    (req, res) => {
        if (validationGuard(req, res)) return;
        return scim.issueToken(req, res);
    }
);

/**
 * @route   GET /api/company/scim/tokens
 * @desc    List issued SCIM tokens (no tokenHash returned)
 * @access  admin / owner
 */
router.get('/company/scim/tokens', ...gate, scim.listTokens);

/**
 * @route   DELETE /api/company/scim/tokens/:tokenId
 * @desc    Revoke a SCIM token
 * @access  admin / owner
 */
router.delete('/company/scim/tokens/:tokenId', ...gate, scim.revokeToken);

// ── HR Sync Management ────────────────────────────────────────────────────────

/**
 * @route   POST /api/company/integrations/sync
 * @desc    Trigger a manual HR sync against a configured provider
 * @access  admin / owner
 * @body    { provider: 'workday'|'bamboohr'|'rippling', config: Object }
 *
 * NOTE: In production, config values should come from Company.hrIntegration
 *       (stored encrypted). This endpoint accepts override config for testing.
 */
router.post(
    '/company/integrations/sync',
    ...gate,
    [
        body('provider')
            .isIn(['workday', 'bamboohr', 'rippling'])
            .withMessage('provider must be workday, bamboohr, or rippling'),
        body('config')
            .isObject()
            .withMessage('config is required'),
    ],
    async (req, res) => {
        if (validationGuard(req, res)) return;
        try {
            const { provider, config } = req.body;

            // Run sync — this can take minutes for large orgs.
            // In production this should be queued via BullMQ/Agenda — for now run inline.
            const report = await runHrSync(req.companyId.toString(), provider, config);

            return res.json({ success: true, report });
        } catch (err) {
            return handleError(res, err);
        }
    }
);

/**
 * @route   POST /api/company/integrations/sync/dry-run
 * @desc    Preview a sync without writing to the DB (returns diff only)
 * @access  admin / owner
 */
router.post(
    '/company/integrations/sync/dry-run',
    ...gate,
    [
        body('provider').isIn(['workday', 'bamboohr', 'rippling']),
        body('config').isObject(),
    ],
    async (req, res) => {
        if (validationGuard(req, res)) return;
        try {
            const { provider, config } = req.body;
            const { buildConnector } = require('./hr-sync.service');
            const connector = buildConnector(provider, config);
            const employees = await connector.getEmployees();

            // Diff against DB (read-only)
            const emails = employees.map(e => e.email);
            const existing = await require('../../../models/User').find({
                email: { $in: emails },
                companyId: req.companyId,
            }).select('email accountStatus scimExternalId').lean();

            const existingSet = new Set(existing.map(u => u.email));

            return res.json({
                success: true,
                dryRun: true,
                totalFromProvider: employees.length,
                toCreate: employees.filter(e => !existingSet.has(e.email) && e.status !== 'terminated').length,
                toDisable: employees.filter(e => existingSet.has(e.email) && e.status === 'terminated').length,
                toUpdate: employees.filter(e => existingSet.has(e.email) && e.status !== 'terminated').length,
                // S-12 SECURITY FIX: Return allowlisted fields only — raw connector
                // objects may contain PII beyond what Chttrix requires.
                employees: safeEmployeePreview,
            });
        } catch (err) {
            return handleError(res, err);
        }
    }
);

module.exports = router;
