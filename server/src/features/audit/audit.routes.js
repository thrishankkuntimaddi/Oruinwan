const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/:companyId', auditController.getCompanyAuditLogs);

router.get('/:companyId/export', auditController.exportAuditLogs);

router.get('/:companyId/compliance', auditController.getComplianceLogs);

module.exports = router;
