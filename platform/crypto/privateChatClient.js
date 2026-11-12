// Private chats, client side: one implementation for the web/desktop app and the phone app.
// Each app passes its own HTTP helper; everything else (device keys, sending, reading,
// signatures, safety numbers, key-change warnings) lives here.
//
//   const pc = createPrivateChats({ http, userId, store });
//   await pc.ensureDevice();                    // once per device; registers its public keys
//   const chat = await pc.open(workspaceId, otherUserId);
//   await pc.send(chat, 'hello');
//   const list = await pc.messages(chat);       // [{ id, mine, text, at, error? }]
//
// http: { get(path, query), post(path, body), put(path, body), del(path) } → parsed JSON,
//       paths relative to /api/private (e.g. '/chats').
import { createDeviceKeys, openMessage, PrivateBoxError, safetyNumber, sealMessage } from './privateBox.js';

const DB_NAME = 'oruinwan-private';
const STORE = 'kv';

/** Key/value storage that can hold CryptoKeys: IndexedDB in browsers and the phone's WebView. */
export function indexedDbStore(namespace = 'default') {
  let dbp;
  const db = () => {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = globalThis.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  };
  const run = async (mode, fn) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  };
  const k = (key) => `${namespace}:${key}`;
  return {
    get: (key) => run('readonly', (s) => s.get(k(key))),
    set: (key, value) => run('readwrite', (s) => s.put(value, k(key))),
    remove: (key) => run('readwrite', (s) => s.delete(k(key))),
  };
}

/** In-memory store (tests, or a browser without IndexedDB: keys then last for the session only). */
export function memoryStore() {
  const m = new Map();
  return { get: async (key) => m.get(key), set: async (key, v) => { m.set(key, v); }, remove: async (key) => { m.delete(key); } };
}

const newDeviceId = () => {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

export function createPrivateChats({ http, userId, store, label = 'This device' }) {
  if (!http || !userId || !store) throw new Error('createPrivateChats needs http, userId and store');
  const me = String(userId);
  let device = null; // { deviceId, keys }
  const deviceCache = new Map(); // userId -> { at, devices }

  async function loadDevice() {
    if (device) return device;
    const saved = await store.get(`device:${me}`);
    if (saved?.deviceId && saved?.keys?.ecdh && saved?.keys?.sign) device = saved;
    return device;
  }

  /** Makes this device's keys (first time) and makes sure the server lists them. */
  async function ensureDevice() {
    let d = await loadDevice();
    if (!d) {
      const keys = await createDeviceKeys();
      d = { deviceId: newDeviceId(), keys, createdAt: new Date().toISOString() };
      await store.set(`device:${me}`, d);
      device = d;
    }
    try {
      await http.put(`/devices/${d.deviceId}`, { ecdhKey: d.keys.ecdhPublic, signKey: d.keys.signPublic, label });
    } catch (err) {
      // Revoked from another device, or keys clash: start over with a new device.
      if (err?.status === 409 || err?.status === 410) {
        await store.remove(`device:${me}`);
        device = null;
        return ensureDevice();
      }
      throw err;
    }
    return d;
  }

  async function devicesOf(userIds, { fresh = false } = {}) {
    const want = [...new Set(userIds.map(String))];
    const missing = want.filter((u) => fresh || !deviceCache.has(u) || Date.now() - deviceCache.get(u).at > 60_000);
    if (missing.length) {
      const r = await http.get('/devices', { userIds: missing.join(',') });
      for (const u of missing) deviceCache.set(u, { at: Date.now(), devices: (r.devices || []).filter((d) => String(d.userId) === u) });
    }
    return want.flatMap((u) => deviceCache.get(u)?.devices || []);
  }

  const otherOf = (chat) => String((chat.participants || []).find((p) => String(p) !== me) || me);

  return {
    get deviceId() { return device?.deviceId || null; },
    ensureDevice,
    devicesOf,

    list: (workspaceId) => http.get('/chats', { workspaceId }).then((r) => r.chats || []),
    open: (workspaceId, otherUserId) => http.post('/chats', { workspaceId, userId: String(otherUserId) }).then((r) => r.chat),
    get: (chatId) => http.get(`/chats/${chatId}`).then((r) => r.chat),

    async send(chat, text) {
      const d = await ensureDevice();
      const body = String(text || '').trim();
      if (!body) throw new Error('Type a message first');
      const devices = await devicesOf([me, otherOf(chat)], { fresh: true });
      if (!devices.some((x) => String(x.userId) === otherOf(chat)) && otherOf(chat) !== me) {
        throw new PrivateBoxError('NO_DEVICES', 'They have not opened private chats on any device yet. Ask them to open Private chats once.');
      }
      const clientId = newDeviceId();
      const envelope = await sealMessage({ chatId: chat.id, me: { userId: me, deviceId: d.deviceId, keys: d.keys }, devices, content: { t: 'text', text: body } });
      const r = await http.post(`/chats/${chat.id}/messages`, { clientId, envelope });
      return r.message;
    },

    /** Decrypts one server message. Never throws: unreadable messages carry `error`. */
    async read(chat, m) {
      const d = await loadDevice();
      const base = { id: m.id, mine: String(m.sender) === me, sender: String(m.sender), at: m.createdAt };
      if (!d) return { ...base, error: 'This device has no private chat keys yet.' };
      try {
        const senderDevices = await devicesOf([m.sender]);
        let dev = senderDevices.find((x) => x.deviceId === m.envelope?.sender?.deviceId);
        if (!dev) dev = (await devicesOf([m.sender], { fresh: true })).find((x) => x.deviceId === m.envelope?.sender?.deviceId);
        if (String(m.envelope?.sender?.userId) !== String(m.sender)) throw new PrivateBoxError('BAD_SIGNATURE', 'Sender mismatch');
        const content = await openMessage({ chatId: chat.id, envelope: m.envelope, me: { deviceId: d.deviceId, keys: d.keys }, senderSignKey: dev?.signKey });
        return { ...base, text: String(content?.text ?? '') };
      } catch (err) {
        const why = {
          NOT_FOR_THIS_DEVICE: 'Sent before this device joined. Private messages stay on the devices they were sent to.',
          BAD_SIGNATURE: 'Could not verify who sent this. It is hidden for your safety.',
        }[err?.code] || 'This message could not be decrypted.';
        return { ...base, error: why };
      }
    },

    async messages(chat, { before } = {}) {
      const r = await http.get(`/chats/${chat.id}/messages`, { before });
      const out = [];
      for (const m of r.messages || []) out.push(await this.read(chat, m));
      return out;
    },

    remove: (chat, messageId) => http.del(`/chats/${chat.id}/messages/${messageId}`),

    /**
     * The chat's safety number and whether it changed since this device last saw it
     * (a new device on either side, or keys swapped by someone in between).
     */
    async safety(chat) {
      const people = [me, otherOf(chat)];
      const devices = await devicesOf(people, { fresh: true });
      const number = await safetyNumber(people.map((u) => ({ userId: u, devices: devices.filter((x) => String(x.userId) === u) })));
      const key = `safety:${me}:${chat.id}`;
      const seen = await store.get(key);
      const verified = (await store.get(`verified:${me}:${chat.id}`)) === number;
      if (!seen) await store.set(key, number);
      return { number, changed: Boolean(seen && seen !== number), verified };
    },
    async acceptSafety(chat, number, { verified = false } = {}) {
      await store.set(`safety:${me}:${chat.id}`, number);
      if (verified) await store.set(`verified:${me}:${chat.id}`, number);
    },

    /** Forget this device's keys (sign out). Messages it alone could read become unreadable. */
    async forgetDevice() {
      const d = await loadDevice();
      if (d) await http.del(`/devices/${d.deviceId}`).catch(() => {});
      await store.remove(`device:${me}`);
      device = null;
    },
  };
}
