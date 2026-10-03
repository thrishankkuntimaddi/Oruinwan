'use strict';

/**
 * Who is online. Every instance keeps a local map of the sockets *it* holds
 * (used for the synchronous `getPresence`), and mirrors the same facts into
 * Redis so that a user connected to instance A is online for instance B too:
 *
 *   presence:sockets:<userId>  SET  of "<instanceId>|<socketId>"   (who holds a socket)
 *   presence:user:<userId>     HASH { status, lastSeen }
 *
 * Both keys carry a TTL that a heartbeat refreshes for the users of this
 * instance, so a crashed instance's sockets fall out on their own. Without
 * REDIS_URL only the local map is used, which is right for one instance.
 */

const identity = require('../../identity');
const logger = require('../../../utils/logger');
const { getRedis, INSTANCE_ID } = require('../../shared/redis');

const presenceMap = new Map();

const KEY_TTL_SECONDS = 90;
const HEARTBEAT_MS = 30 * 1000;

const socketsKey = (userId) => `presence:sockets:${userId}`;
const userKey = (userId) => `presence:user:${userId}`;
const socketMember = (socketId) => `${INSTANCE_ID}|${socketId}`;

let redisOverride;
const redis = () => (redisOverride !== undefined ? redisOverride : getRedis());

/** Mirror a change into Redis; a Redis hiccup never breaks presence locally. */
async function mirror(fn) {
  const r = redis();
  if (!r) return null;
  try {
    return await fn(r);
  } catch (err) {
    logger.warn(`[PRESENCE] Redis update failed: ${err.message}`);
    return null;
  }
}

async function setOnline(io, userId, socketId, companyId) {
  const entry = presenceMap.get(userId) || { status: 'offline', socketIds: new Set() };
  entry.status = 'online';
  entry.lastSeen = new Date();
  entry.socketIds.add(socketId);
  presenceMap.set(userId, entry);

  await mirror((r) => r.multi()
    .sadd(socketsKey(userId), socketMember(socketId))
    .expire(socketsKey(userId), KEY_TTL_SECONDS)
    .hset(userKey(userId), 'status', 'online', 'lastSeen', entry.lastSeen.toISOString())
    .expire(userKey(userId), KEY_TTL_SECONDS)
    .exec());

  identity.users.setOnline(userId, true).catch(() => {});

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

  await mirror((r) => r.multi()
    .hset(userKey(userId), 'status', 'idle', 'lastSeen', entry.lastSeen.toISOString())
    .expire(userKey(userId), KEY_TTL_SECONDS)
    .exec());

  identity.users.touchActivity(userId).catch(() => {});

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

  // Sockets still open on this instance: nothing to announce.
  if (entry.socketIds.size > 0) return;

  // No sockets left here: drop the entry so the map does not grow with every user ever seen.
  presenceMap.delete(userId);

  // Another instance may still hold a socket for this user.
  const remaining = await mirror(async (r) => {
    await r.srem(socketsKey(userId), socketMember(socketId));
    return r.scard(socketsKey(userId));
  });
  if (remaining > 0) return;

  const lastSeen = new Date();
  await mirror((r) => r.multi().del(socketsKey(userId)).del(userKey(userId)).exec());

  identity.users.setOnline(userId, false).catch(() => {});

  if (companyId) {
    io.to(`company_${companyId}`).emit('user:offline', {
      userId,
      status: 'offline',
      lastSeen,
    });
  }
}

/** Presence as known to *this* instance (synchronous). Prefer `getPresenceAsync` across instances. */
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

function parseHash(h) {
  if (!h || !h.status) return null;
  return { status: h.status, lastSeen: h.lastSeen ? new Date(h.lastSeen) : null };
}

/** Presence across all instances: local map first, then Redis. */
async function getPresenceAsync(userId) {
  const local = presenceMap.get(userId);
  if (local) return { status: local.status, lastSeen: local.lastSeen };
  const remote = await mirror((r) => r.hgetall(userKey(userId)));
  return parseHash(remote);
}

async function getBulkPresenceAsync(userIds) {
  const ids = [...new Set(userIds.map(String))];
  const result = getBulkPresence(ids);
  const missing = ids.filter((id) => !presenceMap.has(id));
  if (!missing.length) return result;
  const rows = await mirror(async (r) => {
    const pipe = r.pipeline();
    for (const id of missing) pipe.hgetall(userKey(id));
    return pipe.exec();
  });
  if (rows) {
    rows.forEach(([err, hash], i) => {
      const parsed = !err && parseHash(hash);
      if (parsed) result[missing[i]] = parsed;
    });
  }
  return result;
}

/** Refresh the TTL of every user this instance holds, so live users never expire. */
async function heartbeat() {
  if (!presenceMap.size) return;
  await mirror(async (r) => {
    const pipe = r.pipeline();
    for (const userId of presenceMap.keys()) {
      pipe.expire(socketsKey(userId), KEY_TTL_SECONDS);
      pipe.expire(userKey(userId), KEY_TTL_SECONDS);
    }
    await pipe.exec();
  });
}

let heartbeatTimer = null;
function startPresenceHeartbeat() {
  if (heartbeatTimer || !redis()) return;
  heartbeatTimer = setInterval(() => heartbeat().catch(() => {}), HEARTBEAT_MS);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/** On shutdown, drop this instance's sockets so users do not look online for 90s. */
async function releaseAllPresence() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  const entries = [...presenceMap.entries()];
  presenceMap.clear();
  if (!entries.length) return;
  await mirror(async (r) => {
    const pipe = r.pipeline();
    for (const [userId, entry] of entries) {
      for (const socketId of entry.socketIds) pipe.srem(socketsKey(userId), socketMember(socketId));
    }
    await pipe.exec();
  });
}

/** Test hook: use a fake Redis (or null for memory-only). */
function _setRedisForTests(fake) {
  redisOverride = fake;
  presenceMap.clear();
}

module.exports = {
  setOnline, setIdle, setOffline,
  getPresence, getBulkPresence, getPresenceAsync, getBulkPresenceAsync,
  heartbeat, startPresenceHeartbeat, releaseAllPresence,
  _setRedisForTests,
};
