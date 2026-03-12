/**
 * server/src/features/activity/activity.service.js
 *
 * Unified Activity Stream — Service Layer
 *
 * This service is the single place to write and broadcast ActivityEvents.
 * It is imported by:
 *   - ai.controller.js   (AI events)
 *   - tasks controller   (task created/completed)
 *   - notes controller   (note updated)
 *
 * Pattern:
 *   activityService.emit(req, eventData) → persists + socket broadcasts
 *
 * Fire-and-forget:  callers do `.catch(() => {})` so activity never
 * blocks the primary request/response path.
 */

'use strict';

const ActivityEvent = require('../../models/ActivityEvent');

/**
 * Persist an activity event and broadcast it to the workspace socket room.
 *
 * @param {import('express').Request} req   Express request (for io access)
 * @param {object} eventData
 * @param {string}  eventData.type          ActivityEvent type (message|task|note|ai|update|meeting|reaction)
 * @param {string}  [eventData.subtype]     Optional sub-classification
 * @param {string}  eventData.actor         User ID string
 * @param {string}  [eventData.workspaceId] Workspace ID string or null
 * @param {object}  [eventData.payload]     Minimal display payload
 * @returns {Promise<ActivityEvent>}
 */
async function emit(req, { type, subtype, actor, workspaceId, payload = {} }) {
  // Persist
  const event = await ActivityEvent.create({
    type,
    subtype,
    actor,
    workspaceId: workspaceId || undefined,
    payload,
  });

  // Real-time broadcast — non-blocking, best-effort
  try {
    const io = req?.app?.get('io');
    if (io && workspaceId) {
      const populated = await ActivityEvent.findById(event._id)
        .populate('actor', 'firstName lastName username avatarUrl')
        .lean();

      io.to(`workspace:${workspaceId}`).emit('activity:new', populated);
    }
  } catch (broadcastErr) {
    console.error('[ActivityService] Socket broadcast failed:', broadcastErr.message);
  }

  return event;
}

/**
 * Convenience helper for controllers that don't have a req object
 * (e.g. called from Socket.IO handlers). Accepts io directly.
 *
 * @param {import('socket.io').Server} io
 * @param {object} eventData  Same shape as emit()
 */
async function emitWithIo(io, { type, subtype, actor, workspaceId, payload = {} }) {
  const event = await ActivityEvent.create({
    type,
    subtype,
    actor,
    workspaceId: workspaceId || undefined,
    payload,
  });

  try {
    if (io && workspaceId) {
      const populated = await ActivityEvent.findById(event._id)
        .populate('actor', 'firstName lastName username avatarUrl')
        .lean();

      io.to(`workspace:${workspaceId}`).emit('activity:new', populated);
    }
  } catch (broadcastErr) {
    console.error('[ActivityService] Socket broadcast failed:', broadcastErr.message);
  }

  return event;
}

module.exports = { emit, emitWithIo };
