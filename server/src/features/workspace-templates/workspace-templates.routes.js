const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-templates.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

router.get('/', requireAuth, ctrl.listTemplates);
router.get('/:id', requireAuth, ctrl.getTemplate);

router.get('/public', ctrl.listPublicTemplates);

router.post('/:id/import', requireAuth, ctrl.importTemplate);

router.post('/', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.createTemplate);
router.put('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.updateTemplate);
router.delete('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.deleteTemplate);

module.exports = router;
