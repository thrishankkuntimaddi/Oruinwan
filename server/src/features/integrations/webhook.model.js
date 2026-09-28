const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Events that are actually fired somewhere in the server (webhook.trigger.fire):
 *   task.*        -> src/features/tasks/tasks.controller.js (create/update)
 *   message.sent  -> src/modules/messages/messages.service.js createMessage (channel messages, metadata only)
 *   integration.* -> src/features/integrations/integration.service.js
 * Only these may be subscribed to by new webhooks.
 */
const SUPPORTED_WEBHOOK_EVENTS = [
  { event: 'task.created', description: 'A task was created' },
  { event: 'task.updated', description: 'A task was updated' },
  { event: 'task.completed', description: 'A task was marked done' },
  { event: 'message.sent', description: 'A message was posted in a public channel (ids and metadata only; content is end-to-end encrypted)' },
  { event: 'integration.connected', description: 'An integration was connected' },
  { event: 'integration.disconnected', description: 'An integration was disconnected' },
];
const SUPPORTED_EVENT_NAMES = SUPPORTED_WEBHOOK_EVENTS.map(e => e.event);
// Older rows may still reference these; kept valid so existing documents load/save.
const ALL_KNOWN_EVENTS = [...SUPPORTED_EVENT_NAMES, 'file.uploaded', 'meeting.completed', 'meeting.started'];

const webhookSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Legacy single-event subscription (older rows). New rows store `events`.
  event: {
    type: String,
    default: undefined,
    enum: [...ALL_KNOWN_EVENTS, '*']
  },
  // Events this webhook subscribes to ('*' = everything supported).
  events: {
    type: [{ type: String, enum: [...ALL_KNOWN_EVENTS, '*'] }],
    default: undefined
  },
  
  url: {
    type: String,
    required: true
  },
  
  secret: {
    type: String,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastTriggeredAt: Date,
  lastStatusCode: Number,
  failureCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

webhookSchema.index({ workspaceId: 1, isActive: 1, events: 1 });

/** Event list for any row (legacy rows only have `event`). */
function eventsOf(hook) {
  if (hook && Array.isArray(hook.events) && hook.events.length) return hook.events;
  return hook && hook.event ? [hook.event] : [];
}

const Webhook = mongoose.model('Webhook', webhookSchema);
Webhook.SUPPORTED_WEBHOOK_EVENTS = SUPPORTED_WEBHOOK_EVENTS;
Webhook.SUPPORTED_EVENT_NAMES = SUPPORTED_EVENT_NAMES;
Webhook.eventsOf = eventsOf;
module.exports = Webhook;
