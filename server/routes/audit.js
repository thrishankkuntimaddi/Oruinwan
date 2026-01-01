const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const requireAuth = require('../middleware/auth');

// Get audit logs
router.get('/:companyId', requireAuth, auditController.getCompanyAuditLogs);

// Export logs
router.get('/:companyId/export', requireAuth, auditController.exportAuditLogs);

module.exports = router;
