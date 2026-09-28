'use strict';

/**
 * In-memory state of live huddles: who is in which huddle, on which socket.
 *
 * Huddles are a WebRTC mesh (every participant connects to every other), so the
 * participant cap protects clients from the n² connection cost. State lives in
 * this process only; with several server instances behind the Redis adapter a
 * huddle is only fully tracked by the instance its members connect to. Moving
 * group calls to a media server (LiveKit) removes this limitation.
 */

const DEFAULT_MAX_PARTICIPANTS = 6;

function maxParticipantsFromEnv(env = process.env) {
  const n = Number(env.HUDDLE_MAX_PARTICIPANTS);
  return Number.isInteger(n) && n >= 2 ? n : DEFAULT_MAX_PARTICIPANTS;
}

function scopeKey(scope) {
  if (scope.channelId) return `channel:${scope.channelId}`;
  if (scope.dmId) return `dm:${scope.dmId}`;
  if (scope.workspaceId) return `workspace:${scope.workspaceId}`;
  return null;
}

function publicParticipant(p) {
  return { userId: p.userId, username: p.username, audioEnabled: p.audioEnabled, videoEnabled: !!p.videoEnabled, joinedAt: p.joinedAt };
}

class HuddleRegistry {
  constructor({ maxParticipants = DEFAULT_MAX_PARTICIPANTS } = {}) {
    this.maxParticipants = maxParticipants;
    this.huddles = new Map();
  }

  get(huddleId) {
    return this.huddles.get(huddleId) || null;
  }

  /** Create the huddle if needed. Returns { huddle } or { error } when the scope does not match. */
  ensure(huddleId, scope, meta = {}) {
    const key = scopeKey(scope);
    const existing = this.huddles.get(huddleId);
    if (existing) {
      if (existing.scopeKey !== key) return { error: 'HUDDLE_SCOPE_MISMATCH' };
      // A join can reach the server before the starter's huddle:start; the
      // start's video flag must still apply to the huddle it created.
      if (meta.video && !existing.video) existing.video = true;
      return { huddle: existing };
    }
    const huddle = {
      huddleId,
      scopeKey: key,
      channelId: scope.channelId || null,
      dmId: scope.dmId || null,
      workspaceId: scope.workspaceId ? String(scope.workspaceId) : null,
      channelName: meta.channelName || null,
      startedBy: meta.startedBy || null,
      video: !!meta.video,
      startedAt: new Date(),
      participants: new Map(),
    };
    this.huddles.set(huddleId, huddle);
    return { huddle };
  }

  /**
   * Add or refresh a participant. A user re-joining from another socket replaces
   * their old entry; the old socket id is returned so the caller can evict it.
   */
  join(huddleId, { userId, username, audioEnabled = true, videoEnabled = false, socketId }) {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) return { error: 'HUDDLE_NOT_FOUND' };
    const uid = String(userId);
    const previous = huddle.participants.get(uid);
    if (!previous && huddle.participants.size >= this.maxParticipants) {
      return { error: 'HUDDLE_FULL' };
    }
    const others = [...huddle.participants.values()].filter((p) => p.userId !== uid).map(publicParticipant);
    huddle.participants.set(uid, {
      userId: uid,
      username: username || 'Unknown',
      audioEnabled: audioEnabled !== false,
      videoEnabled: !!videoEnabled,
      socketId,
      joinedAt: previous?.joinedAt || new Date(),
    });
    return {
      huddle,
      others,
      replacedSocketId: previous && previous.socketId !== socketId ? previous.socketId : null,
    };
  }

  /**
   * Remove a participant. When socketId is given the entry is only removed if it
   * still belongs to that socket (a stale disconnect must not kick a fresh join).
   * The huddle is deleted when its last participant leaves.
   */
  leave(huddleId, userId, socketId) {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) return { removed: false, ended: false, huddle: null };
    const uid = String(userId);
    const p = huddle.participants.get(uid);
    if (!p || (socketId && p.socketId !== socketId)) return { removed: false, ended: false, huddle };
    huddle.participants.delete(uid);
    const ended = huddle.participants.size === 0;
    if (ended) this.huddles.delete(huddleId);
    return { removed: true, ended, huddle };
  }

  end(huddleId) {
    const huddle = this.huddles.get(huddleId) || null;
    this.huddles.delete(huddleId);
    return huddle;
  }

  participant(huddleId, userId) {
    return this.huddles.get(huddleId)?.participants.get(String(userId)) || null;
  }

  setAudio(huddleId, userId, audioEnabled) {
    const p = this.participant(huddleId, userId);
    if (p) p.audioEnabled = audioEnabled !== false;
    return p;
  }

  setVideo(huddleId, userId, videoEnabled) {
    const p = this.participant(huddleId, userId);
    if (p) p.videoEnabled = !!videoEnabled;
    return p;
  }

  /** Huddle ids in which this socket is the registered connection of some participant. */
  huddlesForSocket(socketId) {
    const ids = [];
    for (const huddle of this.huddles.values()) {
      for (const p of huddle.participants.values()) {
        if (p.socketId === socketId) ids.push(huddle.huddleId);
      }
    }
    return ids;
  }

  summary(huddle) {
    return {
      huddleId: huddle.huddleId,
      channelId: huddle.channelId,
      dmId: huddle.dmId,
      workspaceId: huddle.workspaceId,
      channelName: huddle.channelName,
      startedBy: huddle.startedBy,
      startedAt: huddle.startedAt,
      video: !!huddle.video,
      participants: [...huddle.participants.values()].map(publicParticipant),
    };
  }

  list(predicate = () => true) {
    return [...this.huddles.values()].filter(predicate).map((h) => this.summary(h));
  }
}

const registry = new HuddleRegistry({ maxParticipants: maxParticipantsFromEnv() });

module.exports = { HuddleRegistry, registry, scopeKey, maxParticipantsFromEnv, DEFAULT_MAX_PARTICIPANTS };
