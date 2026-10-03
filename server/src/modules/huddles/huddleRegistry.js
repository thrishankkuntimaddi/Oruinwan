'use strict';

/**
 * State of live huddles: who is in which huddle, on which socket.
 *
 * Huddles are a WebRTC mesh (every participant connects to every other), so the
 * participant cap protects clients from the n² connection cost.
 *
 * Reads are synchronous against this process's copy. With several server
 * instances the copies are kept identical by huddleReplication.js: every
 * mutation here is reported through `onMutation(op)` and applied on the other
 * instances with `applyRemote(op)`, and a Redis snapshot seeds a fresh
 * instance. Socket ids from other instances are still valid emit targets
 * because the Socket.IO Redis adapter routes `io.to(socketId)` fleet-wide.
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

const toDate = (v) => (v instanceof Date ? v : v ? new Date(v) : new Date());

class HuddleRegistry {
  constructor({ maxParticipants = DEFAULT_MAX_PARTICIPANTS } = {}) {
    this.maxParticipants = maxParticipants;
    this.huddles = new Map();
    /** @type {null | ((op: object) => void)} set by huddleReplication to broadcast local changes */
    this.onMutation = null;
    this._applyingRemote = false;
  }

  _changed(op) {
    if (this._applyingRemote || typeof this.onMutation !== 'function') return;
    try { this.onMutation(op); } catch { /* replication must never break a call */ }
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
      let changed = false;
      // A join can reach the server before the starter's huddle:start; the
      // start's video flag must still apply to the huddle it created.
      if (meta.video && !existing.video) { existing.video = true; changed = true; }
      if (!existing.workspaceId && meta.workspaceId) { existing.workspaceId = String(meta.workspaceId); changed = true; }
      if (changed) this._changed({ type: 'ensure', huddle: this._serialize(existing, false) });
      return { huddle: existing };
    }
    const huddle = {
      huddleId,
      scopeKey: key,
      channelId: scope.channelId || null,
      dmId: scope.dmId || null,
      workspaceId: scope.workspaceId ? String(scope.workspaceId) : (meta.workspaceId ? String(meta.workspaceId) : null),
      channelName: meta.channelName || null,
      startedBy: meta.startedBy || null,
      video: !!meta.video,
      startedAt: toDate(meta.startedAt),
      participants: new Map(),
    };
    this.huddles.set(huddleId, huddle);
    this._changed({ type: 'ensure', huddle: this._serialize(huddle, false) });
    return { huddle };
  }

  /**
   * Add or refresh a participant. A user re-joining from another socket replaces
   * their old entry; the old socket id is returned so the caller can evict it.
   */
  join(huddleId, { userId, username, audioEnabled = true, videoEnabled = false, socketId, joinedAt }) {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) return { error: 'HUDDLE_NOT_FOUND' };
    const uid = String(userId);
    const previous = huddle.participants.get(uid);
    if (!previous && huddle.participants.size >= this.maxParticipants) {
      return { error: 'HUDDLE_FULL' };
    }
    const others = [...huddle.participants.values()].filter((p) => p.userId !== uid).map(publicParticipant);
    const participant = {
      userId: uid,
      username: username || 'Unknown',
      audioEnabled: audioEnabled !== false,
      videoEnabled: !!videoEnabled,
      socketId,
      joinedAt: previous?.joinedAt || toDate(joinedAt),
    };
    huddle.participants.set(uid, participant);
    this._changed({ type: 'join', huddleId, participant: { ...participant, joinedAt: participant.joinedAt.toISOString() } });
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
    this._changed({ type: 'leave', huddleId, userId: uid });
    return { removed: true, ended, huddle };
  }

  end(huddleId) {
    const huddle = this.huddles.get(huddleId) || null;
    this.huddles.delete(huddleId);
    if (huddle) this._changed({ type: 'end', huddleId });
    return huddle;
  }

  participant(huddleId, userId) {
    return this.huddles.get(huddleId)?.participants.get(String(userId)) || null;
  }

  setAudio(huddleId, userId, audioEnabled) {
    const p = this.participant(huddleId, userId);
    if (p) {
      p.audioEnabled = audioEnabled !== false;
      this._changed({ type: 'audio', huddleId, userId: p.userId, audioEnabled: p.audioEnabled });
    }
    return p;
  }

  setVideo(huddleId, userId, videoEnabled) {
    const p = this.participant(huddleId, userId);
    if (p) {
      p.videoEnabled = !!videoEnabled;
      this._changed({ type: 'video', huddleId, userId: p.userId, videoEnabled: p.videoEnabled });
    }
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

  // ── Replication ──────────────────────────────────────────────────────────

  /** JSON-safe copy of a huddle (with socket ids, unlike `summary`). */
  _serialize(huddle, withParticipants = true) {
    return {
      huddleId: huddle.huddleId,
      scopeKey: huddle.scopeKey,
      channelId: huddle.channelId,
      dmId: huddle.dmId,
      workspaceId: huddle.workspaceId,
      channelName: huddle.channelName,
      startedBy: huddle.startedBy,
      video: !!huddle.video,
      startedAt: toDate(huddle.startedAt).toISOString(),
      participants: withParticipants
        ? [...huddle.participants.values()].map((p) => ({ ...p, joinedAt: toDate(p.joinedAt).toISOString() }))
        : [],
    };
  }

  /** Every live huddle, JSON-safe, for the shared snapshot. */
  snapshot() {
    return [...this.huddles.values()].map((h) => this._serialize(h, true));
  }

  _restoreOne(data) {
    const huddle = {
      huddleId: data.huddleId,
      scopeKey: data.scopeKey,
      channelId: data.channelId || null,
      dmId: data.dmId || null,
      workspaceId: data.workspaceId || null,
      channelName: data.channelName || null,
      startedBy: data.startedBy || null,
      video: !!data.video,
      startedAt: toDate(data.startedAt),
      participants: new Map((data.participants || []).map((p) => [String(p.userId), { ...p, userId: String(p.userId), joinedAt: toDate(p.joinedAt) }])),
    };
    this.huddles.set(huddle.huddleId, huddle);
    return huddle;
  }

  /** Seed this process from a snapshot (fresh instance). Existing local huddles win. */
  restore(list = []) {
    let n = 0;
    for (const data of list) {
      if (!data || !data.huddleId || this.huddles.has(data.huddleId)) continue;
      this._restoreOne(data);
      n += 1;
    }
    return n;
  }

  /** Apply a mutation that happened on another instance. Never re-broadcasts. */
  applyRemote(op) {
    if (!op || !op.type) return false;
    this._applyingRemote = true;
    try {
      switch (op.type) {
        case 'ensure': {
          const h = op.huddle;
          if (!h || !h.huddleId) return false;
          const existing = this.huddles.get(h.huddleId);
          if (!existing) { this._restoreOne({ ...h, participants: [] }); return true; }
          if (h.video) existing.video = true;
          if (!existing.workspaceId && h.workspaceId) existing.workspaceId = h.workspaceId;
          return true;
        }
        case 'join': {
          const huddle = this.huddles.get(op.huddleId);
          const p = op.participant;
          if (!huddle || !p) return false;
          huddle.participants.set(String(p.userId), { ...p, userId: String(p.userId), joinedAt: toDate(p.joinedAt) });
          return true;
        }
        case 'leave': {
          const huddle = this.huddles.get(op.huddleId);
          if (!huddle) return false;
          huddle.participants.delete(String(op.userId));
          if (huddle.participants.size === 0) this.huddles.delete(op.huddleId);
          return true;
        }
        case 'end':
          return this.huddles.delete(op.huddleId);
        case 'audio': {
          const p = this.participant(op.huddleId, op.userId);
          if (p) p.audioEnabled = op.audioEnabled !== false;
          return !!p;
        }
        case 'video': {
          const p = this.participant(op.huddleId, op.userId);
          if (p) p.videoEnabled = !!op.videoEnabled;
          return !!p;
        }
        default:
          return false;
      }
    } finally {
      this._applyingRemote = false;
    }
  }
}

const registry = new HuddleRegistry({ maxParticipants: maxParticipantsFromEnv() });

module.exports = { HuddleRegistry, registry, scopeKey, maxParticipantsFromEnv, DEFAULT_MAX_PARTICIPANTS };
