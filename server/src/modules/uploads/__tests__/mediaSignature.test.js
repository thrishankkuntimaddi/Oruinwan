'use strict';

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-secret';
const { signMediaPath, verifyMediaSignature } = require('../mediaSignature');

function parse(url) {
  const q = new URL(`http://x${url}`).searchParams;
  return { path: q.get('path'), u: q.get('u'), exp: q.get('exp'), sig: q.get('sig') };
}

describe('signed media URLs', () => {
  test('a fresh signature verifies to the signing user', () => {
    const { url } = signMediaPath('dms/2026-09-25/a.png', 'user1');
    expect(verifyMediaSignature(parse(url))).toBe('user1');
  });

  test('tampering with path, user or expiry invalidates it', () => {
    const q = parse(signMediaPath('dms/a.png', 'user1').url);
    expect(verifyMediaSignature({ ...q, path: 'dms/b.png' })).toBeNull();
    expect(verifyMediaSignature({ ...q, u: 'user2' })).toBeNull();
    expect(verifyMediaSignature({ ...q, exp: String(Number(q.exp) + 60) })).toBeNull();
    expect(verifyMediaSignature({ ...q, sig: 'x' })).toBeNull();
  });

  test('expired links are refused', () => {
    const { url } = signMediaPath('dms/a.png', 'user1', { ttlSeconds: 60, now: Date.now() - 10 * 60 * 1000 });
    expect(verifyMediaSignature(parse(url))).toBeNull();
  });
});
