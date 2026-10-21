'use strict';

/**
 * In-memory stand-ins for the tests: a Mongo-ish model (enough of find/findOne/updateOne/
 * findOneAndUpdate/insertMany for this feature) and a Google Drive appDataFolder behind a
 * fake axios.
 */

const val = (v) => (v instanceof Date ? v.getTime() : v == null ? null : typeof v === 'object' && v._id ? String(v._id) : typeof v === 'object' ? v : String(v));

function get(doc, path) {
    return path.split('.').reduce((o, k) => {
        if (o == null) return undefined;
        if (Array.isArray(o)) return o.map((x) => (x == null ? undefined : x[k]));
        return o[k];
    }, doc);
}

function matchOne(actual, cond) {
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith('$'))) {
        return Object.entries(cond).every(([op, v]) => {
            const a = Array.isArray(actual) ? actual : [actual];
            switch (op) {
                case '$ne': return Array.isArray(actual) ? !actual.map(val).includes(val(v)) : val(actual ?? null) !== val(v);
                case '$in': return a.some((x) => v.map(val).includes(val(x)));
                case '$lt': return actual != null && val(actual) < val(v);
                case '$lte': return actual != null && val(actual) <= val(v);
                case '$exists': return v ? actual !== undefined : actual === undefined;
                default: throw new Error(`fake: unsupported ${op}`);
            }
        });
    }
    if (Array.isArray(actual)) return actual.flat().map(val).includes(val(cond));
    return val(actual ?? null) === val(cond);
}

function matches(doc, filter = {}) {
    return Object.entries(filter).every(([k, cond]) => {
        if (k === '$or') return cond.some((f) => matches(doc, f));
        return matchOne(get(doc, k), cond);
    });
}

function chain(result) {
    const q = {
        select: () => q, sort: () => q, limit: (n) => { result = result.slice(0, n); return q; },
        lean: () => Promise.resolve(result),
        then: (a, b) => Promise.resolve(result).then(a, b),
    };
    return q;
}

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v)));

function fakeModel(initial = []) {
    const docs = initial.map(clone);
    let seq = 0;
    const apply = (doc, update) => {
        const set = update.$set || (Object.keys(update).some((k) => k.startsWith('$')) ? {} : update);
        Object.assign(doc, clone(set));
    };
    const M = {
        docs,
        find: (f) => chain(docs.filter((d) => matches(d, f)).map(clone)),
        findOne: (f) => chain(clone(docs.find((d) => matches(d, f)) || null)),
        exists: async (f) => (docs.some((d) => matches(d, f)) ? { _id: 'x' } : null),
        updateOne: async (f, update, opts = {}) => {
            let d = docs.find((x) => matches(x, f));
            if (!d && opts.upsert) {
                d = { _id: `id${++seq}` };
                for (const [k, v] of Object.entries(f)) if (typeof v !== 'object' || v === null) d[k] = v;
                Object.assign(d, clone(update.$setOnInsert || {}));
                docs.push(d);
            }
            if (d) apply(d, update);
            return { matchedCount: d ? 1 : 0 };
        },
        findOneAndUpdate: (f, update) => {
            const d = docs.find((x) => matches(x, f));
            if (d) apply(d, update);
            return chain(clone(d || null));
        },
        insertMany: async (list) => {
            for (const x of list) {
                if (docs.some((d) => String(d._id) === String(x._id))) throw Object.assign(new Error('dup'), { code: 11000 });
                docs.push(clone(x));
            }
            return list;
        },
    };
    return M;
}

/** A Google Drive appDataFolder + OAuth endpoints behind an axios-shaped client. */
function fakeGoogle() {
    const files = new Map(); // id -> { id, name, bytes, modifiedTime }
    const calls = [];
    const sessions = new Map();
    let n = 0;
    let tick = 0;
    const err = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
    const http = {
        files, calls,
        revoked: [],
        async post(url, body) {
            calls.push(['POST', url]);
            if (url.includes('/revoke')) { http.revoked.push(new URLSearchParams(body).get('token')); return { data: {} }; }
            const p = new URLSearchParams(body);
            if (p.get('grant_type') === 'authorization_code') {
                const payload = Buffer.from(JSON.stringify({ email: p.get('code') === 'code-bob' ? 'bob@gmail.com' : 'ada@gmail.com' })).toString('base64url');
                return { data: { access_token: 'at', refresh_token: `rt-${p.get('code')}`, id_token: `h.${payload}.s`, scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.appdata' } };
            }
            if (p.get('grant_type') === 'refresh_token') {
                if (p.get('refresh_token') === 'rt-revoked') throw err(400, { error: 'invalid_grant' });
                return { data: { access_token: 'at' } };
            }
            throw err(400, { error: 'unsupported' });
        },
        async get(url, { params = {} } = {}) {
            calls.push(['GET', url]);
            if (url.endsWith('/files')) {
                expect(params.spaces).toBe('appDataFolder');
                return { data: { files: [...files.values()].map(({ id, name, bytes, modifiedTime }) => ({ id, name, size: String(bytes.length), modifiedTime })) } };
            }
            const id = decodeURIComponent(url.split('/files/')[1]);
            const f = files.get(id);
            if (!f) throw err(404, {});
            if (params.alt === 'media') return { data: f.bytes };
            return { data: { id: f.id, name: f.name, size: String(f.bytes.length), modifiedTime: f.modifiedTime } };
        },
        async delete(url) {
            calls.push(['DELETE', url]);
            const id = decodeURIComponent(url.split('/files/')[1]);
            if (!files.delete(id)) throw err(404, {});
            return { data: {} };
        },
        async request({ method, url, data }) {
            calls.push([method, url]);
            if (method === 'PUT') {
                const s = sessions.get(url);
                const f = s.id ? files.get(s.id) : { id: `file${++n}`, name: s.name };
                f.bytes = Buffer.from(data);
                f.modifiedTime = new Date(Date.UTC(2026, 9, 21, 0, 0, ++tick)).toISOString();
                files.set(f.id, f);
                return { data: { id: f.id, size: String(f.bytes.length), modifiedTime: f.modifiedTime } };
            }
            const id = method === 'PATCH' ? decodeURIComponent(url.split('/files/')[1]) : null;
            if (id && !files.has(id)) throw err(404, {});
            const meta = JSON.parse(data || '{}');
            if (!id) expect(meta.parents).toEqual(['appDataFolder']);
            const loc = `https://upload.test/session/${sessions.size + 1}`;
            sessions.set(loc, { id, name: meta.name });
            return { headers: { location: loc }, data: {} };
        },
    };
    http.addFile = (name = 'oruinwan-backup.bin', bytes = Buffer.from('old'), modifiedTime = '2026-01-01T00:00:00.000Z') => {
        const id = `file${++n}`;
        files.set(id, { id, name, bytes, modifiedTime });
        return id;
    };
    return http;
}

module.exports = { fakeModel, fakeGoogle, matches };
