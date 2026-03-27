// server/src/features/integrations/webhook.trigger.js
// Async webhook trigger — fires registered webhook URLs for workspace events
const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('./webhook.model');
const logger = require('../../../utils/logger');
const notifEmitter = require('../notifications/notificationEventEmitter');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 9000]; // exponential backoff

/**
 * Fire all active webhooks for the given workspaceId + event.
 * Runs asynchronously — does not block the caller.
 */
function fire(workspaceId, event, data = {}) {
  // Run async, don't await — callers should not wait for webhook delivery
  _dispatch(workspaceId, event, data).catch(err =>
    logger.error(`[Webhook] Dispatch error for ${event}:`, err.message)
  );
}

async function _dispatch(workspaceId, event, data) {
  // Find all active webhooks matching the event (including wildcard *)
  const hooks = await Webhook.find({
    workspaceId,
    isActive: true,
    event: { $in: [event, '*'] }
  }).lean();

  if (!hooks.length) return;

  const payload = {
    event,
    workspaceId: workspaceId.toString(),
    data,
    timestamp: new Date().toISOString()
  };

  await Promise.allSettled(hooks.map(hook => _sendWithRetry(hook, payload)));
}

async function _sendWithRetry(hook, payload, attempt = 0) {
  const payloadStr = JSON.stringify(payload);
  const signature = _sign(payloadStr, hook.secret);

  try {
    const response = await axios.post(hook.url, payload, {
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'X-Chttrix-Event': payload.event,
        'X-Chttrix-Signature': signature,
        'X-Chttrix-Delivery': hook._id.toString()
      }
    });

    // Update stats
    await Webhook.findByIdAndUpdate(hook._id, {
      lastTriggeredAt: new Date(),
      lastStatusCode: response.status,
      failureCount: 0
    });

    logger.debug(`[Webhook] Delivered ${payload.event} to ${hook.url} (${response.status})`);
  } catch (err) {
    const statusCode = err.response?.status || 0;
    logger.warn(`[Webhook] Attempt ${attempt + 1} failed for ${hook.url}: ${err.message}`);

    await Webhook.findByIdAndUpdate(hook._id, {
      lastTriggeredAt: new Date(),
      lastStatusCode: statusCode,
      $inc: { failureCount: 1 }
    });

    if (attempt < MAX_RETRIES - 1) {
      await _sleep(RETRY_DELAYS_MS[attempt]);
      return _sendWithRetry(hook, payload, attempt + 1);
    }

    logger.error(`[Webhook] All retries exhausted for ${hook.url}`);

    // Notify workspace admins about persistent webhook failure
    try {
        const Integration = require('./integration.model');
        const integration = await Integration.findOne({ workspaceId: hook.workspaceId }).lean();
        const adminIds = integration?.adminIds || [];
        if (adminIds.length > 0) {
            notifEmitter.emit('integration.webhook_failed', {
                io: null, // no io here — will rely on polling
                adminIds: adminIds.map(id => id.toString()),
                workspaceId: hook.workspaceId?.toString(),
                integrationName: hook.event,
                errorMessage: `Webhook to ${hook.url} failed after ${MAX_RETRIES} attempts`,
            });
        }
    } catch (notifErr) {
        logger.warn('[Webhook] Failed to emit webhook_failed notification:', notifErr.message);
    }
  }
}

function _sign(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fire };
