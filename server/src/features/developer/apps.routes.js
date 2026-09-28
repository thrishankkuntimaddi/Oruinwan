const express = require('express');
const router = express.Router();
const App = require('./app.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const { requireWorkspaceAccess, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { installApp, uninstallApp, toPublicApp } = require('./appInstall.service');

router.use(requireAuth);

const memberFromQuery = requireWorkspaceAccess({ from: (req) => req.query?.workspaceId, optional: true });
const adminFromBody = requireWorkspaceAccess({ from: (req) => req.body?.workspaceId || req.query?.workspaceId, adminOnly: true });

// GET /api/developer/apps[?workspaceId=] — never exposes installedIn.
router.get('/apps', memberFromQuery, async (req, res) => {
  try {
    const workspaceId = req.workspaceAccess?.workspaceId || null;
    const apps = await App.find({ isPublished: true })
      .select('name description category developer version iconUrl installedIn')
      .lean();

    res.json({ apps: apps.map(app => toPublicApp(app, workspaceId)) });
  } catch (err) {
    logger.error('[Apps] GET error:', err.message);
    res.status(500).json({ message: 'Failed to fetch apps' });
  }
});

// Install / uninstall require workspace owner/admin.
router.post('/apps/:id/install', adminFromBody, async (req, res) => {
  try {
    const result = await installApp(req.params.id, req.workspaceAccess.workspaceId);
    res.json({ message: `${result.name} installed successfully`, ...result });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Apps] POST /install error:', err.message);
    res.status(500).json({ message: 'Failed to install app' });
  }
});

async function uninstallHandler(req, res) {
  try {
    const result = await uninstallApp(req.params.id, req.workspaceAccess.workspaceId);
    res.json({ message: `${result.name} uninstalled successfully`, ...result });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[Apps] uninstall error:', err.message);
    res.status(500).json({ message: 'Failed to uninstall app' });
  }
}
router.delete('/apps/:id/uninstall', adminFromBody, uninstallHandler);
router.post('/apps/:id/uninstall', adminFromBody, uninstallHandler);

module.exports = router;
