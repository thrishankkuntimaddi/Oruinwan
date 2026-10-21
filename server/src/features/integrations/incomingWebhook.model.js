'use strict';

const mongoose = require('mongoose');

/**
 * A Slack-compatible incoming webhook: POST {"text": "…"} to
 * /api/v2/integrations/hooks/:id/:token and the "Incoming webhook" bot posts
 * it in `channelId`. The token is sealed under SERVER_KEK (admins can copy
 * the URL again); `name` is shown as the poster.
 */
const incomingWebhookSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  token: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: Date,
  useCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.IncomingWebhook || mongoose.model('IncomingWebhook', incomingWebhookSchema);
