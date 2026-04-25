const express = require('express');
const router = express.Router();
const App = require('./app.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');

router.use(requireAuth);

router.get('/apps', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const apps = await App.find({ isPublished: true })
      .select('name description category developer version iconUrl installedIn')
      .lean();

    const result = apps.map(app => ({
      ...app,
      installed: workspaceId
        ? app.installedIn?.some(id => id.toString() === workspaceId)
        : false
    }));

    res.json({ apps: result });
  } catch (err) {
    logger.error('[Apps] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

router.post('/apps/:id/install', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });

    const alreadyInstalled = app.installedIn.some(id => id.toString() === workspaceId);
    if (alreadyInstalled) return res.status(409).json({ error: 'App already installed' });

    app.installedIn.push(workspaceId);
    await app.save();

    res.json({ message: `${app.name} installed successfully` });
  } catch (err) {
    logger.error('[Apps] POST /install error:', err.message);
    res.status(500).json({ error: 'Failed to install app' });
  }
});

router.delete('/apps/:id/uninstall', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });

    app.installedIn = app.installedIn.filter(id => id.toString() !== workspaceId);
    await app.save();

    res.json({ message: `${app.name} uninstalled successfully` });
  } catch (err) {
    logger.error('[Apps] DELETE /uninstall error:', err.message);
    res.status(500).json({ error: 'Failed to uninstall app' });
  }
});

module.exports = router;
