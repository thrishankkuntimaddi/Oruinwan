/**
 * server/models/ActivityEvent.js
 *
 * Unified Activity Stream — Mongoose Model
 *
 * Every meaningful event in Chttrix is persisted here:
 *   message | task | note | ai | update | meeting | reaction
 *
 * The feed endpoint queries this collection and the socket layer
 * emits `activity:new` in real-time so the UI can prepend events.
 */

'use strict';

const mongoose = require('mongoose');

const ACTIVITY_TYPES = ['message', 'task', 'note', 'ai', 'update', 'meeting', 'reaction'];
const ACTIVITY_SUBTYPES = [
  // message
  'sent', 'deleted', 'edited',
  // task
  'created', 'completed', 'assigned', 'updated',
  // note
  'created', 'updated', 'deleted',
  // ai
  'chat', 'summary', 'task_generated',
  // update
  'posted',
  // meeting
  'scheduled', 'started', 'ended',
  // reaction
  'added',
];

const activityEventSchema = new mongoose.Schema(
  {
    /** One of the canonical activity types */
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
      index: true,
    },

    /** Optional sub-classification within a type */
    subtype: {
      type: String,
      enum: ACTIVITY_SUBTYPES,
    },

    /** The user who triggered the event */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /** Workspace scope — null for workspace-agnostic events */
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },

    /**
     * Arbitrary event data. Kept minimal — only what the UI needs
     * to render a single feed row without extra DB round-trips.
     *
     * Examples:
     *   message  → { channelId, channelName, preview }
     *   task     → { taskId, title, priority }
     *   ai       → { prompt, response }
     *   note     → { noteId, title }
     */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,   // createdAt used as event timestamp in the feed
    versionKey: false,
  }
);

// Compound index: fast per-workspace feed sorted by newest first
activityEventSchema.index({ workspaceId: 1, createdAt: -1 });

// Compound index: per-user activity history
activityEventSchema.index({ actor: 1, createdAt: -1 });

const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);

module.exports = ActivityEvent;
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
