'use strict';

const config = require('../config');

/**
 * Bounded in-process conversation memory.
 *
 * Keyed by user and workspace. Every conversation keeps at most `maxTurns`
 * turns, expires after `ttlMs` of inactivity, and the store as a whole keeps
 * at most `maxConversations` entries (least recently used are dropped). No
 * timers are used, so the store can never keep a process alive or leak.
 *
 * The interface (get / append / clear / prune) is small on purpose so a
 * Redis-backed implementation can replace it for multi-instance deployments.
 */
class ConversationMemory {
  constructor({ maxTurns, ttlMs, maxConversations } = {}) {
    this.maxTurns = maxTurns ?? config.memory.maxTurns;
    this.ttlMs = ttlMs ?? config.memory.ttlMs;
    this.maxConversations = maxConversations ?? config.memory.maxConversations;
    this._store = new Map(); // key -> { turns: [], touchedAt }
  }

  static key(userId, workspaceId) {
    return `${userId || 'anonymous'}:${workspaceId || 'global'}`;
  }

  /** @returns {Array<{ role: 'user'|'model', text: string, at: number }>} */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return [];
    if (Date.now() - entry.touchedAt > this.ttlMs) {
      this._store.delete(key);
      return [];
    }
    // Refresh LRU position.
    this._store.delete(key);
    entry.touchedAt = Date.now();
    this._store.set(key, entry);
    return entry.turns.slice();
  }

  append(key, turns) {
    const list = Array.isArray(turns) ? turns : [turns];
    const existing = this.get(key);
    const merged = existing.concat(
      list
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.text, at: t.at || Date.now() }))
    );
    const turnsKept = merged.slice(-this.maxTurns);
    this._store.set(key, { turns: turnsKept, touchedAt: Date.now() });
    this.prune();
    return turnsKept;
  }

  clear(key) {
    return this._store.delete(key);
  }

  /** Drop expired conversations and enforce the size cap. */
  prune() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now - v.touchedAt > this.ttlMs) this._store.delete(k);
    }
    while (this._store.size > this.maxConversations) {
      const oldest = this._store.keys().next().value;
      this._store.delete(oldest);
    }
  }

  get size() {
    return this._store.size;
  }
}

module.exports = ConversationMemory;
