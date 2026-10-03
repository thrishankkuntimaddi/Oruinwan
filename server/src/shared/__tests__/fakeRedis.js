'use strict';

/**
 * A tiny in-memory stand-in for the ioredis subset used by presence, the job
 * scheduler, huddle replication and the event bus (streams + consumer groups). Shared by their tests. Pub/sub is wired
 * between every client created from the same `createFakeRedisHub()`.
 */

function createFakeRedisHub() {
    const store = new Map(); // key -> { type, value }
    const subscribers = new Set();
    // Streams: key -> { entries: [{ id, fields }], groups: Map(group -> { next, pending: Map(id -> { consumer, at }) }) }
    const streams = new Map();
    let seq = 0;
    const streamOf = (key, create) => {
        if (!streams.has(key) && create) streams.set(key, { entries: [], groups: new Map() });
        return streams.get(key) || null;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function client() {
        const self = {
            status: 'ready',
            store,
            handlers: new Map(),
            subscriptions: new Set(),
            async set(key, value, ...args) {
                const nx = args.includes('NX');
                if (nx && store.has(key)) return null;
                store.set(key, { type: 'string', value });
                return 'OK';
            },
            async get(key) { return store.get(key)?.value ?? null; },
            async del(...keys) { let n = 0; for (const k of keys) n += store.delete(k) ? 1 : 0; return n; },
            async expire() { return 1; },
            async sadd(key, ...members) {
                const e = store.get(key) || { type: 'set', value: new Set() };
                let n = 0;
                for (const m of members) { if (!e.value.has(m)) { e.value.add(m); n += 1; } }
                store.set(key, e);
                return n;
            },
            async srem(key, ...members) {
                const e = store.get(key);
                if (!e) return 0;
                let n = 0;
                for (const m of members) n += e.value.delete(m) ? 1 : 0;
                if (!e.value.size) store.delete(key);
                return n;
            },
            async scard(key) { return store.get(key)?.value.size || 0; },
            async hset(key, ...fv) {
                const e = store.get(key) || { type: 'hash', value: {} };
                for (let i = 0; i < fv.length; i += 2) e.value[fv[i]] = String(fv[i + 1]);
                store.set(key, e);
                return 1;
            },
            async hgetall(key) { return { ...(store.get(key)?.value || {}) }; },
            async hdel(key, ...fields) {
                const e = store.get(key);
                if (!e) return 0;
                let n = 0;
                for (const f of fields) { if (f in e.value) { delete e.value[f]; n += 1; } }
                return n;
            },
            multi() { return pipeline(); },
            pipeline() { return pipeline(); },
            async publish(channel, message) {
                for (const s of subscribers) {
                    if (s.subscriptions.has(channel)) for (const h of s.handlers.get('message') || []) h(channel, message);
                }
                return subscribers.size;
            },
            async subscribe(channel) { self.subscriptions.add(channel); subscribers.add(self); },
            async unsubscribe(channel) { self.subscriptions.delete(channel); },
            on(event, handler) { self.handlers.set(event, [...(self.handlers.get(event) || []), handler]); return self; },
            off(event, handler) { self.handlers.set(event, (self.handlers.get(event) || []).filter((h) => h !== handler)); return self; },
            duplicate() { return client(); },
            async quit() { self.closed = true; return 'OK'; },
            disconnect() { self.closed = true; },
            // ── Streams ──
            async xadd(key, ...args) {
                let i = 0;
                if (args[0] === 'MAXLEN') i = 3; // MAXLEN ~ n
                if (args[i] !== '*') throw new Error('fake xadd: only auto ids');
                const fields = args.slice(i + 1);
                const st = streamOf(key, true);
                seq += 1;
                const id = `${Date.now()}-${seq}`;
                st.entries.push({ id, fields });
                return id;
            },
            async xlen(key) { return streamOf(key)?.entries.length || 0; },
            async xrange(key) { return (streamOf(key)?.entries || []).map((e) => [e.id, e.fields]); },
            async xgroup(sub, key, group, id, mkstream) {
                if (sub !== 'CREATE') throw new Error('fake xgroup: only CREATE');
                const st = streamOf(key, mkstream === 'MKSTREAM');
                if (!st) throw new Error('ERR The XGROUP subcommand requires the key to exist');
                if (st.groups.has(group)) throw new Error('BUSYGROUP Consumer Group name already exists');
                st.groups.set(group, { next: id === '$' ? st.entries.length : 0, pending: new Map() });
                return 'OK';
            },
            async xreadgroup(_g, group, consumer, _c, count, _b, blockMs, _s, key) {
                const deadline = Date.now() + Number(blockMs || 0);
                for (;;) {
                    if (self.closed) throw new Error('Connection is closed.');
                    const st = streamOf(key);
                    const grp = st?.groups.get(group);
                    if (!grp) throw new Error('NOGROUP No such consumer group');
                    const batch = st.entries.slice(grp.next, grp.next + Number(count));
                    if (batch.length) {
                        grp.next += batch.length;
                        for (const e of batch) grp.pending.set(e.id, { consumer, at: Date.now() });
                        return [[key, batch.map((e) => [e.id, e.fields])]];
                    }
                    if (Date.now() >= deadline) return null;
                    await sleep(5);
                }
            },
            async xack(key, group, ...ids) {
                const grp = streamOf(key)?.groups.get(group);
                if (!grp) return 0;
                let n = 0;
                for (const id of ids) n += grp.pending.delete(id) ? 1 : 0;
                return n;
            },
            async xpending(key, group) { const grp = streamOf(key)?.groups.get(group); return [grp ? grp.pending.size : 0]; },
            async xautoclaim(key, group, consumer, minIdle, _start, _c, count) {
                const st = streamOf(key);
                const grp = st?.groups.get(group);
                if (!grp) throw new Error('NOGROUP No such consumer group');
                const now = Date.now();
                const claimed = [];
                for (const [id, p] of grp.pending) {
                    if (now - p.at >= Number(minIdle)) {
                        grp.pending.set(id, { consumer, at: now });
                        const e = st.entries.find((x) => x.id === id);
                        claimed.push(e ? [e.id, e.fields] : [id, null]);
                        if (claimed.length >= Number(count || 100)) break;
                    }
                }
                return ['0-0', claimed, []];
            },
            _streams: streams,
        };
        function pipeline() {
            const ops = [];
            const p = new Proxy({}, {
                get(_, name) {
                    if (name === 'exec') return async () => {
                        const out = [];
                        for (const [m, args] of ops) {
                            try { out.push([null, await self[m](...args)]); } catch (err) { out.push([err, null]); }
                        }
                        return out;
                    };
                    return (...args) => { ops.push([name, args]); return p; };
                },
            });
            return p;
        }
        return self;
    }

    return { client, store };
}

module.exports = { createFakeRedisHub };
