const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const { scopedCompanyId } = requireCompanyAdmin;

// Company admins read only their own company's logs; platform admins any.
router.use(requireAuth, requireCompanyAdmin);
router.param('companyId', (req, res, next, companyId) => {
    if (!scopedCompanyId(req, res, companyId)) return res.headersSent ? undefined : res.status(403).json({ message: 'Access denied' });
    next();
});

router.get('/:companyId', auditController.getCompanyAuditLogs);

router.get('/:companyId/export', auditController.exportAuditLogs);

router.get('/:companyId/compliance', auditController.getComplianceLogs);

module.exports = router;
