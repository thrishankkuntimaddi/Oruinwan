const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const scim = require('./scim.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const { runHrSync } = require('./hr-sync.service');

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

const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

router.post('/scim/users', scim.scimAuth, scim.createUser);
router.get('/scim/users', scim.scimAuth, scim.listUsers);
router.get('/scim/users/:id', scim.scimAuth, scim.getUser);
router.patch('/scim/users/:id', scim.scimAuth, scim.updateUser);
router.delete('/scim/users/:id', scim.scimAuth, scim.deactivateUser);

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

router.get('/company/scim/tokens', ...gate, scim.listTokens);

router.delete('/company/scim/tokens/:tokenId', ...gate, scim.revokeToken);

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

            
            
            const report = await runHrSync(req.companyId.toString(), provider, config);

            return res.json({ success: true, report });
        } catch (err) {
            return handleError(res, err);
        }
    }
);

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
                
                
                employees: safeEmployeePreview,
            });
        } catch (err) {
            return handleError(res, err);
        }
    }
);

module.exports = router;
