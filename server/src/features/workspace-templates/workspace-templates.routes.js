// server/src/features/workspace-templates/workspace-templates.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-templates.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

// Public list (also works for personal accounts — no requireCompanyMember)
router.get('/', requireAuth, ctrl.listTemplates);
router.get('/:id', requireAuth, ctrl.getTemplate);

// ── COMMUNITY: Public template marketplace (no auth required) ─────────────────
router.get('/public', ctrl.listPublicTemplates);
// Auth required to import a template into your workspace
router.post('/:id/import', requireAuth, ctrl.importTemplate);
// ───────────────────────────────────────────────────────────────────────────

// Admin-only mutations (company accounts)
router.post('/', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.createTemplate);
router.put('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.updateTemplate);
router.delete('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.deleteTemplate);

module.exports = router;
