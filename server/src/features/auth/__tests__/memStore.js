'use strict';

/** In-memory stand-in for otpStore with a controllable clock (tests only). */
function memStore(clock = { now: 1_000_000 }) {
  const map = new Map();
  const live = (k) => {
    const e = map.get(k);
    if (!e) return null;
    if (clock.now >= e.exp) { map.delete(k); return null; }
    return e;
  };
  return {
    clock,
    map,
    async set(k, v, ttl) { map.set(k, { v: JSON.parse(JSON.stringify(v)), exp: clock.now + ttl }); },
    async get(k) { const e = live(k); return e ? JSON.parse(JSON.stringify(e.v)) : null; },
    async delete(k) { map.delete(k); },
    async take(k) { const e = live(k); map.delete(k); return e ? e.v : null; },
    async incr(k, ttl) { const e = live(k); const n = (e ? e.v : 0) + 1; map.set(k, { v: n, exp: e ? e.exp : clock.now + ttl }); return n; },
  };
}

function mockRes() {
  return {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
    redirect(url) { this.redirectedTo = url; return this; },
  };
}

function mockReq({ body = {}, headers = {}, user = null, params = {} } = {}) {
  const h = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', ...headers };
  return { body, headers: h, user, params, ip: '203.0.113.9', cookies: {}, socket: {}, get(n) { return h[String(n).toLowerCase()]; } };
}

module.exports = { memStore, mockRes, mockReq };
