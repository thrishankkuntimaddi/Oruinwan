'use strict';
const logger = require('../../../utils/logger');

const ActivityEvent = require('../../models/ActivityEvent');

// Actors live in PostgreSQL; attach them with hydrate (populate cannot reach them).
const { hydrate } = require('../../identity/hydrate');
const ACTOR = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };

async function emit(req, { type, subtype, actor, workspaceId, payload = {} }) {
  
  const event = await ActivityEvent.create({
    type,
    subtype,
    actor,
    workspaceId: workspaceId || undefined,
    payload,
  });

  
  try {
    const io = req?.app?.get('io');
    if (io && workspaceId) {
      const populated = await ActivityEvent.findById(event._id).lean();
      await hydrate(populated, { actor: ACTOR });

      io.to(`workspace:${workspaceId}`).emit('activity:new', populated);
    }
  } catch (broadcastErr) {
    logger.error('[ActivityService] Socket broadcast failed:', broadcastErr.message);
  }

  return event;
}

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
      const populated = await ActivityEvent.findById(event._id).lean();
      await hydrate(populated, { actor: ACTOR });

      io.to(`workspace:${workspaceId}`).emit('activity:new', populated);
    }
  } catch (broadcastErr) {
    logger.error('[ActivityService] Socket broadcast failed:', broadcastErr.message);
  }

  return event;
}

module.exports = { emit, emitWithIo };
