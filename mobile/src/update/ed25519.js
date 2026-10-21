// Ed25519 signature verification (RFC 8032), for checking over-the-air UI bundles.
// Uses WebCrypto's Ed25519 where the WebView has it, and otherwise this small BigInt
// implementation of the RFC's reference verify (SHA-512 still comes from WebCrypto).
// Verification only: nothing secret is handled here, so constant time doesn't matter.

const P = 2n ** 255n - 19n;
const L = 2n ** 252n + 27742317777372353535851937790883648493n;

const mod = (a, m = P) => {
  const r = a % m;
  return r >= 0n ? r : r + m;
};

function pow(base, exp, m = P) {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

const inv = (x) => pow(x, P - 2n);
const D = mod(-121665n * inv(121666n));
const SQRT_M1 = pow(2n, (P - 1n) / 4n);

function add(p, q) {
  const a = mod((p[1] - p[0]) * (q[1] - q[0]));
  const b = mod((p[1] + p[0]) * (q[1] + q[0]));
  const c = mod(2n * p[3] * q[3] * D);
  const d = mod(2n * p[2] * q[2]);
  const e = b - a;
  const f = d - c;
  const g = d + c;
  const h = b + a;
  return [mod(e * f), mod(g * h), mod(f * g), mod(e * h)];
}

function mul(s, point) {
  let q = [0n, 1n, 1n, 0n];
  let p = point;
  let k = s;
  while (k > 0n) {
    if (k & 1n) q = add(q, p);
    p = add(p, p);
    k >>= 1n;
  }
  return q;
}

const equal = (p, q) => mod(p[0] * q[2] - q[0] * p[2]) === 0n && mod(p[1] * q[2] - q[1] * p[2]) === 0n;

function recoverX(y, sign) {
  if (y >= P) return null;
  const x2 = mod((y * y - 1n) * inv(D * y * y + 1n));
  if (x2 === 0n) return sign ? null : 0n;
  let x = pow(x2, (P + 3n) / 8n);
  if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1);
  if (mod(x * x - x2) !== 0n) return null;
  if (Number(x & 1n) !== sign) x = P - x;
  return x;
}

const littleEndian = (bytes) => {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) n = (n << 8n) | BigInt(bytes[i]);
  return n;
};

function decompress(bytes) {
  if (bytes.length !== 32) return null;
  let y = littleEndian(bytes);
  const sign = Number(y >> 255n);
  y &= (1n << 255n) - 1n;
  const x = recoverX(y, sign);
  return x === null ? null : [x, y, 1n, mod(x * y)];
}

const GY = mod(4n * inv(5n));
const G = [recoverX(GY, 0), GY, 1n, mod(recoverX(GY, 0) * GY)];

export function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const subtle = () => globalThis.crypto?.subtle;

/** The reference verify; exported for tests. */
export async function verifyFallback(publicKey, message, signature) {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  const a = decompress(publicKey);
  const rBytes = signature.subarray(0, 32);
  const r = decompress(rBytes);
  if (!a || !r) return false;
  const s = littleEndian(signature.subarray(32));
  if (s >= L) return false;
  const data = new Uint8Array(64 + message.length);
  data.set(rBytes, 0);
  data.set(publicKey, 32);
  data.set(message, 64);
  const h = mod(littleEndian(new Uint8Array(await subtle().digest('SHA-512', data))), L);
  return equal(mul(s, G), add(r, mul(h, a)));
}

/**
 * True when `signature` (base64) is a valid Ed25519 signature of `message` (string) by
 * `publicKey` (base64 of the raw 32-byte key).
 */
export async function verifyEd25519(publicKeyB64, message, signatureB64) {
  let publicKey;
  let signature;
  try {
    publicKey = fromBase64(publicKeyB64);
    signature = fromBase64(signatureB64);
  } catch {
    return false;
  }
  const bytes = new TextEncoder().encode(message);
  try {
    const key = await subtle().importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await subtle().verify({ name: 'Ed25519' }, key, signature, bytes);
  } catch {
    // No Ed25519 in this WebView's WebCrypto: verify in JavaScript.
    return verifyFallback(publicKey, bytes, signature);
  }
}
