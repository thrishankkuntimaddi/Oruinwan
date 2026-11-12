// Private chats: end-to-end encryption between devices (web, desktop and phone share this file).
//
// Every device has its own two key pairs, made on the device and never sent anywhere:
//   - ECDH P-256  to receive message keys
//   - ECDSA P-256 to sign what it sends
// Only the public halves go to the server. A message is encrypted once with a fresh AES-256-GCM
// key; that key is wrapped for every device of both people (ephemeral ECDH → HKDF-SHA-256 →
// AES-GCM). The sender's device signs the whole envelope, so the server can neither read, change,
// reroute nor forge messages. The server holds no copy of any key (unlike other conversations).
//
// What this does not give: forward secrecy beyond the per-message ephemeral key, history on a new
// device, or recovery when every device is lost. People compare a safety number to be sure the
// server handed out the real keys.

const VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser has no Web Crypto; private chats need a secure (https) page.');
  return s;
};
const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  if (typeof b64 !== 'string' || !b64) throw new Error('bad base64');
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) u8[i] = s.charCodeAt(i);
  return u8;
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

/**
 * A new device identity. Private keys are non-extractable CryptoKeys (they can be kept in
 * IndexedDB but never read out); public keys come back as base64 SPKI for the server.
 */
export async function createDeviceKeys() {
  const ecdh = await subtle().generateKey(ECDH, false, ['deriveBits']);
  const sign = await subtle().generateKey(ECDSA, false, ['sign', 'verify']);
  return {
    ecdh,
    sign,
    ecdhPublic: toB64(await subtle().exportKey('spki', ecdh.publicKey)),
    signPublic: toB64(await subtle().exportKey('spki', sign.publicKey)),
  };
}

const importEcdh = (b64) => subtle().importKey('spki', fromB64(b64), ECDH, false, []);
const importVerify = (b64) => subtle().importKey('spki', fromB64(b64), ECDSA, false, ['verify']);
const aesKey = (raw, usage) => subtle().importKey('raw', raw, 'AES-GCM', false, usage);

async function wrapKeyFor(ephPrivate, salt, chatId, device) {
  const shared = await subtle().deriveBits({ name: 'ECDH', public: await importEcdh(device.ecdhKey) }, ephPrivate, 256);
  const hkdf = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(`oruinwan-private-v${VERSION}|${chatId}|${device.deviceId}`) },
    hkdf, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

const contentAad = (chatId, sender) => enc.encode(`oruinwan-private-v${VERSION}|${chatId}|${sender.userId}|${sender.deviceId}`);

/** The exact bytes a sender signs: everything in the envelope except the signature. */
function signedBytes(chatId, e) {
  const keys = [...e.keys].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).map((k) => `${k.d}:${k.iv}:${k.k}`).join(',');
  return enc.encode([`v${e.v}`, chatId, e.sender.userId, e.sender.deviceId, e.eph, e.salt, e.iv, e.ct, keys].join('|'));
}

/**
 * Encrypts `content` (any JSON value) for `devices` ([{ deviceId, ecdhKey }], include the
 * sender's own devices so they can read it back). `me` = { userId, deviceId, keys }.
 */
export async function sealMessage({ chatId, me, devices, content }) {
  if (!chatId || !me?.userId || !me?.deviceId || !me?.keys?.sign) throw new Error('sealMessage: missing sender');
  if (!Array.isArray(devices) || !devices.length) throw new Error('sealMessage: no recipient devices');
  const sender = { userId: String(me.userId), deviceId: String(me.deviceId) };
  const contentKey = random(32);
  const iv = random(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: contentAad(chatId, sender) },
    await aesKey(contentKey, ['encrypt']), enc.encode(JSON.stringify(content)));
  const eph = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const salt = random(16);
  const seen = new Set();
  const keys = [];
  for (const d of devices) {
    if (!d?.deviceId || !d?.ecdhKey || seen.has(d.deviceId)) continue;
    seen.add(d.deviceId);
    const wiv = random(12);
    const kek = await wrapKeyFor(eph.privateKey, salt, chatId, d);
    keys.push({ d: String(d.deviceId), iv: toB64(wiv), k: toB64(await subtle().encrypt({ name: 'AES-GCM', iv: wiv }, kek, contentKey)) });
  }
  const envelope = {
    v: VERSION,
    sender,
    eph: toB64(await subtle().exportKey('spki', eph.publicKey)),
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ct),
    keys,
  };
  envelope.sig = toB64(await subtle().sign(SIGN, me.keys.sign.privateKey, signedBytes(chatId, envelope)));
  return envelope;
}

export class PrivateBoxError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Checks the sender's signature, then decrypts with this device's key. `senderSignKey` is the
 * sender device's public signing key (base64 SPKI) as listed by the server.
 * Throws PrivateBoxError: BAD_SIGNATURE, NOT_FOR_THIS_DEVICE, UNREADABLE.
 */
export async function openMessage({ chatId, envelope, me, senderSignKey }) {
  const e = envelope;
  if (!e || e.v !== VERSION || !e.sender || !Array.isArray(e.keys)) throw new PrivateBoxError('UNREADABLE', 'Unknown message format');
  if (!senderSignKey) throw new PrivateBoxError('BAD_SIGNATURE', 'The sender’s device is unknown');
  const ok = await subtle().verify(SIGN, await importVerify(senderSignKey), fromB64(e.sig || ''), signedBytes(chatId, e)).catch(() => false);
  if (!ok) throw new PrivateBoxError('BAD_SIGNATURE', 'This message’s signature does not match its sender');
  const mine = e.keys.find((k) => k.d === String(me.deviceId));
  if (!mine) throw new PrivateBoxError('NOT_FOR_THIS_DEVICE', 'Sent before this device was added');
  try {
    const shared = await subtle().deriveBits({ name: 'ECDH', public: await importEcdh(e.eph) }, me.keys.ecdh.privateKey, 256);
    const hkdf = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const kek = await subtle().deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: fromB64(e.salt), info: enc.encode(`oruinwan-private-v${VERSION}|${chatId}|${me.deviceId}`) },
      hkdf, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    const contentKey = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(mine.iv) }, kek, fromB64(mine.k));
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(e.iv), additionalData: contentAad(chatId, e.sender) },
      await aesKey(contentKey, ['decrypt']), fromB64(e.ct));
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new PrivateBoxError('UNREADABLE', 'This message could not be decrypted');
  }
}

/**
 * Safety number of a private chat: 60 digits from both people's device keys, the same on both
 * sides. If it matches what the other person sees, nobody swapped keys in between.
 */
export async function safetyNumber(people) {
  const parts = [...people]
    .map((p) => `${p.userId}=${[...(p.devices || [])].map((d) => `${d.signKey}.${d.ecdhKey}`).sort().join(',')}`)
    .sort();
  const hash = new Uint8Array(await subtle().digest('SHA-256', enc.encode(`oruinwan-safety-v1|${parts.join('|')}`)));
  const groups = [];
  for (let i = 0; i < 12; i += 1) {
    const n = ((hash[i * 2] << 16) | (hash[i * 2 + 1] << 8) | hash[(i * 2 + 24) % 32]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups.join(' ');
}
