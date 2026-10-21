const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-templates.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const requireWorkspaceAdmin = require('../../shared/middleware/requireWorkspaceAdmin');

// '/public' and '/community' must come before '/:id', which would otherwise treat them as ids.
router.get('/public', ctrl.listPublicTemplates);

// ── Community gallery (docs/api/community.md) ──
const community = require('./community.controller');
const { requireWorkspaceAccess } = require('../../shared/utils/workspaceAccess');
const { requirePlatformAdmin } = require('../developer/platformAdmin.middleware');
const adminOfBodyWorkspace = requireWorkspaceAccess({ from: (req) => req.body?.workspaceId, adminOnly: true });
router.get('/community', community.listCommunity);
router.get('/community/mine', requireAuth, community.listMine);
router.get('/community/admin', requireAuth, requirePlatformAdmin, community.adminList);
router.post('/community/admin/:id/moderate', requireAuth, requirePlatformAdmin, community.moderate);
router.post('/community/publish', requireAuth, adminOfBodyWorkspace, community.publish);
router.patch('/community/:id', requireAuth, community.update);
router.delete('/community/:id', requireAuth, community.unpublish);
router.post('/community/:id/rate', requireAuth, community.rate);
router.post('/community/:id/report', requireAuth, community.report);
// Personal accounts see public templates; company members also see their
// company's own, so load the caller's company without requiring one.
const identity = require('../../identity');
async function withCompany(req, res, next) {
  try {
    if (!req.user._dbUser) {
      req.user._dbUser = await identity.users.findById(req.user.sub);
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/', requireAuth, withCompany, ctrl.listTemplates);
router.get('/:id', requireAuth, withCompany, ctrl.getTemplate);

// Applying a template changes the target workspace: its admins only. (:id is the
// template, so point the membership check at body.workspaceId.)
const targetWorkspace = (req, res, next) => { req.params.workspaceId = req.body?.workspaceId; next(); };
router.post('/:id/import', requireAuth, withCompany, targetWorkspace, requireWorkspaceMember, requireWorkspaceAdmin, ctrl.importTemplate);

router.post('/', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.createTemplate);
router.put('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.updateTemplate);
router.delete('/:id', requireAuth, requireCompanyMember, requireCompanyRole('admin'), ctrl.deleteTemplate);

module.exports = router;
