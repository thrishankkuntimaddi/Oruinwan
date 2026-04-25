'use strict';

const ActivityEvent = require('../../models/ActivityEvent');

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
