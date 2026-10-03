const ApiKey = require('./apiKey.model');
const logger = require('../../../utils/logger');

/**
 * Authenticates a public-API request by its X-Api-Key header. Sets
 * req.apiKeyDoc and req.workspaceId. The key's workspace must still be active.
 * Errors are { message }.
 */
module.exports = async function apiKeyMiddleware(req, res, next) {
  try {
    const rawKey = req.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      return res.status(401).json({ message: 'Missing X-Api-Key header' });
    }

    const keyHash = ApiKey.hashKey(rawKey);
    const apiKeyDoc = await ApiKey.findOne({ keyHash, isActive: true }).lean();

    if (!apiKeyDoc) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    const { workspaces } = require('../../identity');
    const ws = await workspaces.findById(apiKeyDoc.workspaceId, { activeOnly: true });
    if (!ws) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    req.apiKeyDoc = apiKeyDoc;
    req.workspaceId = apiKeyDoc.workspaceId;

    ApiKey.findByIdAndUpdate(apiKeyDoc._id, {
      lastUsedAt: new Date(),
      $inc: { usageCount: 1 }
    }).catch(err => logger.error('[APIKey] Failed to update lastUsedAt:', err.message));

    next();
  } catch (err) {
    logger.error('[APIKey Middleware] Error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
