// server/src/features/developer/apiKey.middleware.js
// Validates X-Api-Key header and attaches workspace scope to request
const ApiKey = require('./apiKey.model');
const logger = require('../../../utils/logger');

module.exports = async function apiKeyMiddleware(req, res, next) {
  try {
    const rawKey = req.headers['x-api-key'];
    if (!rawKey) {
      return res.status(401).json({ error: 'Missing X-Api-Key header' });
    }

    const keyHash = ApiKey.hashKey(rawKey);
    const apiKeyDoc = await ApiKey.findOne({ keyHash, isActive: true }).lean();

    if (!apiKeyDoc) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    // Attach workspace scope and permissions
    req.apiKeyDoc = apiKeyDoc;
    req.workspaceId = apiKeyDoc.workspaceId;

    // Update last used (fire-and-forget)
    ApiKey.findByIdAndUpdate(apiKeyDoc._id, {
      lastUsedAt: new Date(),
      $inc: { usageCount: 1 }
    }).catch(err => logger.error('[APIKey] Failed to update lastUsedAt:', err.message));

    next();
  } catch (err) {
    logger.error('[APIKey Middleware] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
