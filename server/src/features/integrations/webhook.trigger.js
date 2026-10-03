const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('./webhook.model');
const logger = require('../../../utils/logger');
const notifEmitter = require('../../modules/notifications/notificationEventEmitter');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 9000]; 

/**
 * Fire an outgoing webhook event. With Redis the event goes on the bus and the
 * webhook dispatcher consumer (a jobs process) delivers it; without Redis it is
 * delivered directly from here, as before. Never throws into the caller.
 */
function fire(workspaceId, event, data = {}) {
  const bus = require('../../shared/events/bus');
  const { isKnownEvent } = require('../../shared/events/catalog');
  if (bus.hasRedis() && isKnownEvent(event)) {
    const actorId = data.createdBy || data.updatedBy || data.deletedBy || data.senderId || null;
    bus.publish(event, data, { workspaceId, actorId })
      .catch(err => logger.error(`[Webhook] Could not publish ${event}:`, err.message));
    return;
  }
  _dispatch(workspaceId, event, data).catch(err =>
    logger.error(`[Webhook] Dispatch error for ${event}:`, err.message)
  );
}

async function _dispatch(workspaceId, event, data) {
  
  const hooks = await Webhook.find({
    workspaceId,
    isActive: true,
    // New rows store `events: [..]`; legacy rows only have `event`.
    $or: [
      { events: { $in: [event, '*'] } },
      { event: { $in: [event, '*'] } }
    ]
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

    
    try {
        const Integration = require('./integration.model');
        const integration = await Integration.findOne({ workspaceId: hook.workspaceId }).lean();
        const adminIds = integration?.adminIds || [];
        if (adminIds.length > 0) {
            notifEmitter.emit('integration.webhook_failed', {
                io: null, 
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

function _headers(event, signature, deliveryId) {
  return {
    'Content-Type': 'application/json',
    'X-Chttrix-Event': event,
    'X-Chttrix-Signature': signature,
    'X-Chttrix-Delivery': deliveryId
  };
}

/**
 * Send one signed `webhook.test` payload to `hook.url` (no retries).
 * Resolves { status, ok } — status is the HTTP status of the receiver, or 0
 * when it could not be reached.
 */
async function sendTest(hook, { triggeredBy } = {}) {
  const payload = {
    event: 'webhook.test',
    workspaceId: String(hook.workspaceId),
    data: { webhookId: String(hook._id), message: 'This is a test delivery.', triggeredBy: triggeredBy ? String(triggeredBy) : undefined },
    timestamp: new Date().toISOString()
  };
  // Sign exactly the bytes we send.
  const body = JSON.stringify(payload);
  const signature = _sign(body, hook.secret);
  let status = 0;
  try {
    const response = await axios.post(hook.url, body, {
      timeout: 8000,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: _headers(payload.event, signature, String(hook._id))
    });
    status = response.status;
  } catch (err) {
    status = err.response?.status || 0;
  }
  const ok = status >= 200 && status < 300;
  try {
    await Webhook.findByIdAndUpdate(hook._id, { lastTriggeredAt: new Date(), lastStatusCode: status });
  } catch { /* stats are best-effort */ }
  return { status, ok };
}

module.exports = { fire, sendTest, _sign, _dispatch };
