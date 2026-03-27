/**
 * Chttrix — Presence Service
 *
 * Tracks user online/idle/offline status in-memory (via Map) and persists
 * to the User document. Socket event names follow the pattern:
 *   user:online  — user connected (or became active)
 *   user:idle    — user went idle
 *   user:offline — user disconnected or explicitly went offline
 */
'use strict';

const User = require('../../../models/User');

// In-memory presence map: userId (string) → { status, lastSeen, socketIds }
const presenceMap = new Map();

/**
 * Mark a user as online.
 * @param {object} io         - Socket.IO server instance
 * @param {string} userId     - User's MongoDB _id as string
 * @param {string} socketId   - The connecting socket's id
 * @param {string} [companyId] - Company room to broadcast to
 */
async function setOnline(io, userId, socketId, companyId) {
  const entry = presenceMap.get(userId) || { status: 'offline', socketIds: new Set() };
  entry.status = 'online';
  entry.lastSeen = new Date();
  entry.socketIds.add(socketId);
  presenceMap.set(userId, entry);

  // Persist to DB (fire-and-forget)
  User.findByIdAndUpdate(userId, { isOnline: true, lastActivityAt: new Date() }).catch(() => {});

  // Broadcast to company room
  if (companyId) {
    io.to(`company_${companyId}`).emit('user:online', {
      userId,
      status: 'online',
      timestamp: entry.lastSeen,
    });
  }
}

/**
 * Mark a user as idle.
 * @param {object} io
 * @param {string} userId
 * @param {string} [companyId]
 */
async function setIdle(io, userId, companyId) {
  const entry = presenceMap.get(userId);
  if (!entry) return;
  entry.status = 'idle';
  entry.lastSeen = new Date();
  presenceMap.set(userId, entry);

  User.findByIdAndUpdate(userId, { lastActivityAt: new Date() }).catch(() => {});

  if (companyId) {
    io.to(`company_${companyId}`).emit('user:idle', {
      userId,
      status: 'idle',
      timestamp: entry.lastSeen,
    });
  }
}

/**
 * Mark a user as offline (on socket disconnect).
 * Only broadcasts if no other sockets remain for this user.
 * @param {object} io
 * @param {string} userId
 * @param {string} socketId   - The disconnecting socket's id
 * @param {string} [companyId]
 */
async function setOffline(io, userId, socketId, companyId) {
  const entry = presenceMap.get(userId);
  if (!entry) return;

  entry.socketIds.delete(socketId);

  // If the user still has other open sockets (e.g., desktop + mobile), stay online
  if (entry.socketIds.size > 0) return;

  entry.status = 'offline';
  entry.lastSeen = new Date();
  presenceMap.set(userId, entry);

  User.findByIdAndUpdate(userId, { isOnline: false, lastActivityAt: new Date() }).catch(() => {});

  if (companyId) {
    io.to(`company_${companyId}`).emit('user:offline', {
      userId,
      status: 'offline',
      lastSeen: entry.lastSeen,
    });
  }
}

/**
 * Get the current presence entry for a user.
 * @param {string} userId
 * @returns {{ status: string, lastSeen: Date, socketIds: Set } | undefined}
 */
function getPresence(userId) {
  return presenceMap.get(userId);
}

/**
 * Get presence for a list of user IDs.
 * @param {string[]} userIds
 * @returns {object} { [userId]: { status, lastSeen } }
 */
function getBulkPresence(userIds) {
  const result = {};
  for (const id of userIds) {
    const entry = presenceMap.get(id);
    result[id] = entry
      ? { status: entry.status, lastSeen: entry.lastSeen }
      : { status: 'offline', lastSeen: null };
  }
  return result;
}

module.exports = { setOnline, setIdle, setOffline, getPresence, getBulkPresence };
