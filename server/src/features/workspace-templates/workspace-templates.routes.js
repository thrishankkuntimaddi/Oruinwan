const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-templates.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const requireWorkspaceAdmin = require('../../shared/middleware/requireWorkspaceAdmin');

// '/public' must come before '/:id', which would otherwise treat "public" as an id.
router.get('/public', ctrl.listPublicTemplates);
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
