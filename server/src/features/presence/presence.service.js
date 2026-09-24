'use strict';

const User = require('../../../models/User');

const presenceMap = new Map();

async function setOnline(io, userId, socketId, companyId) {
  const entry = presenceMap.get(userId) || { status: 'offline', socketIds: new Set() };
  entry.status = 'online';
  entry.lastSeen = new Date();
  entry.socketIds.add(socketId);
  presenceMap.set(userId, entry);

  
  User.findByIdAndUpdate(userId, { isOnline: true, lastActivityAt: new Date() }).catch(() => {});

  
  if (companyId) {
    io.to(`company_${companyId}`).emit('user:online', {
      userId,
      status: 'online',
      timestamp: entry.lastSeen,
    });
  }
}

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

async function setOffline(io, userId, socketId, companyId) {
  const entry = presenceMap.get(userId);
  if (!entry) return;

  entry.socketIds.delete(socketId);

  
  if (entry.socketIds.size > 0) return;

  const lastSeen = new Date();
  // No sockets left: drop the entry so the map does not grow with every user ever seen.
  presenceMap.delete(userId);

  User.findByIdAndUpdate(userId, { isOnline: false, lastActivityAt: new Date() }).catch(() => {});

  if (companyId) {
    io.to(`company_${companyId}`).emit('user:offline', {
      userId,
      status: 'offline',
      lastSeen,
    });
  }
}

function getPresence(userId) {
  return presenceMap.get(userId);
}

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
