// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyEd25519, verifyFallback } from './ed25519.js';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const pubB64 = pub.toString('base64');
const signB64 = (msg) => sign(null, Buffer.from(msg), privateKey).toString('base64');
const bytes = (s) => new TextEncoder().encode(s);

describe('ed25519', () => {
  it('accepts a valid signature (WebCrypto or fallback)', async () => {
    expect(await verifyEd25519(pubB64, 'hello', signB64('hello'))).toBe(true);
  });

  it('rejects a changed message, signature or key', async () => {
    const sig = signB64('hello');
    expect(await verifyEd25519(pubB64, 'hellO', sig)).toBe(false);
    const bad = Buffer.from(sig, 'base64');
    bad[10] ^= 1;
    expect(await verifyEd25519(pubB64, 'hello', bad.toString('base64'))).toBe(false);
    const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    expect(await verifyEd25519(other.toString('base64'), 'hello', sig)).toBe(false);
    expect(await verifyEd25519('not base64!', 'hello', sig)).toBe(false);
  });

  it('the JavaScript fallback matches Node', async () => {
    for (const msg of ['', 'a', `oruinwan-ui-bundle\nphone\n2.1.0\n${'ab'.repeat(32)}`]) {
      const sig = new Uint8Array(Buffer.from(signB64(msg), 'base64'));
      expect(await verifyFallback(new Uint8Array(pub), bytes(msg), sig)).toBe(true);
      const tampered = sig.slice();
      tampered[40] ^= 0x80;
      expect(await verifyFallback(new Uint8Array(pub), bytes(msg), tampered)).toBe(false);
      expect(await verifyFallback(new Uint8Array(pub), bytes(`${msg}x`), sig)).toBe(false);
    }
  });

  it('rejects wrong lengths and non-canonical S', async () => {
    expect(await verifyFallback(new Uint8Array(31), bytes('x'), new Uint8Array(64))).toBe(false);
    const sig = new Uint8Array(Buffer.from(signB64('x'), 'base64'));
    sig.fill(0xff, 32);
    expect(await verifyFallback(new Uint8Array(pub), bytes('x'), sig)).toBe(false);
  });
});
