'use strict';

const redisModule = require('../../redis');
const otpStore = require('../otpStore');

// Just enough of ioredis for the commands the store uses.
function fakeRedis() {
  const data = new Map(); // key -> { v, exp }
  const live = (k) => {
    const e = data.get(k);
    if (!e) return null;
    if (e.exp !== null && Date.now() >= e.exp) { data.delete(k); return null; }
    return e;
  };
  const ops = {
    async set(k, v, unit, ms) { data.set(k, { v: String(v), exp: Date.now() + Number(ms) }); return 'OK'; },
    async get(k) { const e = live(k); return e ? e.v : null; },
    async del(k) { data.delete(k); return 1; },
    multi() {
      const queue = [];
      const chain = {
        incr(k) { queue.push(() => { const e = live(k); const n = (e ? Number(e.v) : 0) + 1; data.set(k, { v: String(n), exp: e ? e.exp : null }); return n; }); return chain; },
        pexpire(k, ms, mode) { queue.push(() => { const e = live(k); if (e && (mode !== 'NX' || e.exp === null)) e.exp = Date.now() + Number(ms); return 1; }); return chain; },
        async exec() { return queue.map(f => [null, f()]); },
      };
      return chain;
    },
  };
  return ops;
}

beforeEach(() => redisModule._setClientForTests(fakeRedis()));
afterAll(() => redisModule._setClientForTests(null));

test('stores and expires values in Redis', async () => {
  await otpStore.set('k1', { otp: '123456', expires: 1 }, 60000);
  expect(await otpStore.get('k1')).toEqual({ otp: '123456', expires: 1 });
  await otpStore.delete('k1');
  expect(await otpStore.get('k1')).toBeNull();
});

test('incr counts up and keeps the original expiry', async () => {
  expect(await otpStore.incr('c', 60000)).toBe(1);
  expect(await otpStore.incr('c', 60000)).toBe(2);
  expect(await otpStore.incr('c', 60000)).toBe(3);
});

test('parallel increments each get their own number (no lost updates)', async () => {
  const counts = await Promise.all(Array.from({ length: 8 }, () => otpStore.incr('race', 60000)));
  expect(counts.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test('without Redis the same behaviour holds in memory', async () => {
  redisModule._setClientForTests(null);
  // Force the in-memory path: getRedis() returns null when no client and no REDIS_URL.
  delete process.env.REDIS_URL;
  await otpStore.set('mem', 'v', 60000);
  expect(await otpStore.get('mem')).toBe('v');
  expect(await otpStore.incr('memc', 60000)).toBe(1);
  expect(await otpStore.incr('memc', 60000)).toBe(2);
});
