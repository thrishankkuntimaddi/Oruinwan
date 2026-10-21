// The query cache on disk, so the app opens offline with the last data it had.
//
// The snapshot holds decrypted message text, so it is never stored in the clear: it is
// encrypted with AES-GCM under a device key that is created on this device, is not extractable,
// and lives in IndexedDB next to the snapshot ('oru-cache'). Signing out or wiping the device
// deletes both. Without Web Crypto or IndexedDB nothing is persisted.
import { hydrateQueries, onQueryWrite, snapshotQueries } from './query.js';

const VERSION = 1;
const DB = 'oru-cache';
const STORE = 'kv';

// What is worth keeping: lists and the items people open. Search results, drafts and
// anything short-lived (signed URLs, AI) are refetched.
const PREFIXES = [
  'channels:', 'dms:', 'members:', 'tasks:', 'task:', 'taskplan:', 'notes:', 'note:', 'notifications:', 'knowledge:', 'page:',
  'files:', 'file:', 'meetinglist:', 'meeting:', 'meetings:', 'planning:', 'sprints:', 'milestones:', 'messages:', 'thread:',
];
const MAX_CONVERSATIONS = 40; // messages:/thread: entries, most recently updated first
const MAX_BYTES = 4 * 1024 * 1024;

/** A message the server hasn't confirmed (optimistic, uploading, failed) is not saved. */
const settled = (m) => m && !m.pending && !m.upload && !m.failed && !m.queued;

/**
 * Picks the entries to save from snapshotQueries(): only known prefixes, at most
 * MAX_CONVERSATIONS conversations, unconfirmed messages dropped, and under MAX_BYTES.
 */
export function selectPersistable(snapshot, { maxConversations = MAX_CONVERSATIONS, maxBytes = MAX_BYTES } = {}) {
  const keep = [];
  const convs = [];
  for (const [key, e] of snapshot || []) {
    if (!PREFIXES.some((p) => key.startsWith(p))) continue;
    if (key.startsWith('messages:') || key.startsWith('thread:')) {
      const items = Array.isArray(e.data?.items) ? e.data.items.filter(settled) : null;
      convs.push([key, { ...e, data: items ? { ...e.data, items: items.slice(-100) } : e.data }]);
    } else keep.push([key, e]);
  }
  convs.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  const out = [...keep, ...convs.slice(0, maxConversations)];
  // Over the budget: drop the oldest conversations first, then the oldest of the rest.
  let json = JSON.stringify(out);
  while (json.length > maxBytes && out.length) {
    const convAt = out.map(([k]) => k.startsWith('messages:') || k.startsWith('thread:')).lastIndexOf(true);
    out.splice(convAt >= 0 ? convAt : out.length - 1, 1);
    json = JSON.stringify(out);
  }
  return out;
}

// ---------------------------------------------------------------- storage

function idbStore() {
  if (typeof indexedDB === 'undefined') return null;
  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async (mode, fn) => {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)),
    del: (k) => run('readwrite', (s) => s.delete(k)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
}

const subtle = () => globalThis.crypto?.subtle || null;

/**
 * A persister over a key-value store ({ get, set, del, clear }, IndexedDB by default).
 * Snapshots are scoped (server + user), so another account never sees them.
 */
export function createPersister(store = idbStore()) {
  let key = null;

  async function deviceKey() {
    if (key) return key;
    const existing = await store.get('device-key');
    if (existing) return (key = existing);
    key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await store.set('device-key', key);
    return key;
  }

  const enabled = () => Boolean(store && subtle());

  return {
    enabled,
    async save(scope, entries) {
      if (!enabled() || !scope) return false;
      const k = await deviceKey();
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify({ v: VERSION, scope, at: Date.now(), entries }));
      const data = await subtle().encrypt({ name: 'AES-GCM', iv }, k, plain);
      await store.set(`snap:${scope}`, { iv, data });
      return true;
    },
    async load(scope) {
      if (!enabled() || !scope) return null;
      try {
        const rec = await store.get(`snap:${scope}`);
        if (!rec) return null;
        const k = await deviceKey();
        const plain = await subtle().decrypt({ name: 'AES-GCM', iv: rec.iv }, k, rec.data);
        const snap = JSON.parse(new TextDecoder().decode(plain));
        return snap?.v === VERSION && snap.scope === scope ? snap.entries : null;
      } catch {
        return null; // another device key (restored backup) or a damaged record: start fresh
      }
    },
    async clear() {
      key = null;
      if (store) await store.clear().catch(() => {});
    },
  };
}

// ---------------------------------------------------------------- app wiring

const persister = createPersister();
let scope = null;
let timer = null;
let offWrite = null;

/** "<server>|<userId>": whose snapshot this is. */
export const cacheScope = (server, userId) => (server && userId ? `${server}|${userId}` : null);

export async function flushCache() {
  clearTimeout(timer);
  timer = null;
  if (!scope) return;
  try {
    await persister.save(scope, selectPersistable(snapshotQueries()));
  } catch {
    /* storage full or blocked: the app still works, it just opens empty offline */
  }
}

/** Loads the saved snapshot for this account into the cache, then keeps saving changes. */
export async function startCache(nextScope) {
  stopCache();
  scope = nextScope;
  if (!scope || !persister.enabled()) return 0;
  const entries = await persister.load(scope).catch(() => null);
  if (entries) hydrateQueries(entries);
  offWrite = onQueryWrite(() => {
    if (!timer) timer = setTimeout(flushCache, 2500);
  });
  return entries?.length || 0;
}

export function stopCache() {
  offWrite?.();
  offWrite = null;
  clearTimeout(timer);
  timer = null;
  scope = null;
}

/** Signing out: forget every saved snapshot and the device key. */
export async function clearCache() {
  stopCache();
  await persister.clear();
}
