'use strict';

/**
 * A small in-memory stand-in for a Mongoose model, for tests that want to check the
 * stored result rather than which methods were called. It understands the query and
 * update operators the meetings / huddles code uses:
 *   query:  equality (array fields match any element; null matches missing), dotted paths
 *           through arrays, $or/$and/$nor, $in/$nin/$ne/$gt/$gte/$lt/$lte/$exists/$regex
 *   update: $set (incl. 'arr.$.field' positional), $push ($each), $addToSet ($each),
 *           $pull (value or condition), $unset, plain objects (= $set)
 *   reads:  find/findOne/findById (+ select/sort/limit/lean chain, thenable), exists,
 *           create, updateOne, updateMany, findOneAndUpdate (new / new:false), deleteOne
 * Ids are stored as 24-hex strings; Dates stay Dates.
 */

const { Types } = require('mongoose');

const isOid = (v) => v && typeof v === 'object' && (v._bsontype === 'ObjectId' || v._bsontype === 'ObjectID') && typeof v.toHexString === 'function';

function normalize(v) {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (isOid(v)) return v.toHexString();
    if (v instanceof Date) return new Date(v.getTime());
    if (v instanceof RegExp) return v;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === 'object') {
        const out = {};
        for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = normalize(x);
        return out;
    }
    return v;
}

const clone = (v) => normalize(v);
const cmpVal = (v) => (v instanceof Date ? v.getTime() : (isOid(v) ? v.toHexString() : v));

/** Every value at a dotted path (arrays along the way are flattened). */
function valuesAt(doc, path) {
    let current = [doc];
    for (const key of path.split('.')) {
        const next = [];
        for (const c of current) {
            if (c == null) continue;
            if (Array.isArray(c) && !/^\d+$/.test(key)) {
                for (const el of c) if (el != null && typeof el === 'object') next.push(el[key]);
            } else {
                next.push(c[key]);
            }
        }
        current = next;
    }
    const flat = [];
    for (const v of current) {
        if (Array.isArray(v)) flat.push(v, ...v);
        else flat.push(v);
    }
    return flat;
}

const eq = (a, b) => {
    const x = cmpVal(normalize(a));
    const y = cmpVal(normalize(b));
    if (x == null && y == null) return true;
    if (x instanceof RegExp) return typeof y === 'string' && x.test(y);
    return x === y;
};

function matchOps(values, cond) {
    const present = values.filter((v) => v !== undefined);
    const scalar = present.filter((v) => !Array.isArray(v));
    const any = (fn) => scalar.some(fn);
    for (const [op, arg] of Object.entries(cond)) {
        switch (op) {
            case '$in': if (!(arg || []).some((a) => (a == null ? !scalar.length || any((v) => v == null) : any((v) => eq(v, a))))) return false; break;
            case '$nin': if ((arg || []).some((a) => any((v) => eq(v, a)))) return false; break;
            case '$ne':
                if (arg == null) { if (!any((v) => v != null)) return false; } else if (any((v) => eq(v, arg))) return false;
                break;
            case '$gt': if (!any((v) => v != null && cmpVal(normalize(v)) > cmpVal(normalize(arg)))) return false; break;
            case '$gte': if (!any((v) => v != null && cmpVal(normalize(v)) >= cmpVal(normalize(arg)))) return false; break;
            case '$lt': if (!any((v) => v != null && cmpVal(normalize(v)) < cmpVal(normalize(arg)))) return false; break;
            case '$lte': if (!any((v) => v != null && cmpVal(normalize(v)) <= cmpVal(normalize(arg)))) return false; break;
            case '$exists': if ((present.length > 0) !== !!arg) return false; break;
            case '$regex': {
                const re = arg instanceof RegExp ? arg : new RegExp(arg, cond.$options || '');
                if (!any((v) => typeof v === 'string' && re.test(v))) return false;
                break;
            }
            case '$options': break;
            default: throw new Error(`memoryCollection: unsupported operator ${op}`);
        }
    }
    return true;
}

function matches(doc, query = {}) {
    for (const [key, cond] of Object.entries(query || {})) {
        if (key === '$or') { if (!cond.some((q) => matches(doc, q))) return false; continue; }
        if (key === '$and') { if (!cond.every((q) => matches(doc, q))) return false; continue; }
        if (key === '$nor') { if (cond.some((q) => matches(doc, q))) return false; continue; }
        if (key === '$expr') continue;
        const values = valuesAt(doc, key);
        const isOpObject = cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !isOid(cond)
            && !(cond instanceof RegExp) && Object.keys(cond).some((k) => k.startsWith('$'));
        if (isOpObject) {
            if (!matchOps(values, cond)) return false;
        } else if (cond == null) {
            if (values.some((v) => v != null && !Array.isArray(v))) return false;
        } else if (!values.some((v) => !Array.isArray(v) && eq(cond, v))) {
            return false;
        }
    }
    return true;
}

/** The index of the first array element matched by the query (for 'arr.$.field'). */
function positionalIndex(doc, query, arrayKey) {
    const arr = doc[arrayKey];
    if (!Array.isArray(arr)) return -1;
    const sub = Object.entries(query).filter(([k]) => k.startsWith(`${arrayKey}.`));
    if (!sub.length) return -1;
    return arr.findIndex((el) => sub.every(([k, v]) => matches(el, { [k.slice(arrayKey.length + 1)]: v })));
}

function setPath(doc, path, value, query) {
    const parts = path.split('.');
    let target = doc;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (parts[i + 1] === '$') {
            const idx = positionalIndex(doc, query, key);
            if (idx < 0) return;
            target = target[key][idx];
            i += 1;
            continue;
        }
        if (target[key] == null || typeof target[key] !== 'object') target[key] = {};
        target = target[key];
    }
    target[parts[parts.length - 1]] = normalize(value);
}

function unsetPath(doc, path) {
    const parts = path.split('.');
    let target = doc;
    for (let i = 0; i < parts.length - 1; i += 1) {
        target = target?.[parts[i]];
        if (target == null) return;
    }
    delete target[parts[parts.length - 1]];
}

function applyUpdate(doc, update, query, { inserting = false } = {}) {
    const ops = Object.keys(update).some((k) => k.startsWith('$')) ? update : { $set: update };
    for (const [op, fields] of Object.entries(ops)) {
        for (const [path, raw] of Object.entries(fields || {})) {
            if (op === '$set') setPath(doc, path, raw, query);
            else if (op === '$setOnInsert') { if (inserting) setPath(doc, path, raw, query); }
            else if (op === '$unset') unsetPath(doc, path);
            else if (op === '$push') {
                const list = Array.isArray(doc[path]) ? doc[path] : (doc[path] = []);
                const items = raw && typeof raw === 'object' && raw.$each ? raw.$each : [raw];
                list.push(...items.map(normalize));
            } else if (op === '$addToSet') {
                const list = Array.isArray(doc[path]) ? doc[path] : (doc[path] = []);
                const items = raw && typeof raw === 'object' && raw.$each ? raw.$each : [raw];
                for (const x of items) if (!list.some((y) => eq(x, y))) list.push(normalize(x));
            } else if (op === '$pull') {
                if (!Array.isArray(doc[path])) continue;
                const isCond = raw && typeof raw === 'object' && !isOid(raw) && !(raw instanceof Date);
                doc[path] = doc[path].filter((el) => (isCond ? !matches(el, raw) : !eq(el, raw)));
            } else throw new Error(`memoryCollection: unsupported update ${op}`);
        }
    }
    return doc;
}

const newId = () => new Types.ObjectId().toHexString();

function sortDocs(docs, spec) {
    const keys = Object.entries(spec || {});
    return docs.sort((a, b) => {
        for (const [k, dir] of keys) {
            const x = cmpVal(valuesAt(a, k)[0]);
            const y = cmpVal(valuesAt(b, k)[0]);
            if (x === y) continue;
            if (x == null) return -1 * dir;
            if (y == null) return 1 * dir;
            return (x < y ? -1 : 1) * dir;
        }
        return 0;
    });
}

function createCollection(name, { methods = {}, defaults = {} } = {}) {
    const docs = [];
    const decorate = (d) => {
        if (!d) return d;
        const out = clone(d);
        for (const [k, fn] of Object.entries(methods)) Object.defineProperty(out, k, { value: fn.bind(out), enumerable: false });
        Object.defineProperty(out, 'toObject', { value: () => clone(d), enumerable: false });
        return out;
    };

    /** run(sortSpec) -> array (many) or array to take the first of (single). */
    function query(run, { single = false } = {}) {
        let sortSpec = null;
        let max = null;
        const q = {
            select: () => q,
            populate: () => q,
            sort: (s) => { sortSpec = s; return q; },
            limit: (n) => { max = n; return q; },
            skip: () => q,
            lean: () => q,
            exec: () => q.then((x) => x),
            then: (res, rej) => Promise.resolve().then(() => {
                let out = run();
                if (Array.isArray(out)) {
                    if (sortSpec) out = sortDocs(out.slice(), sortSpec);
                    if (max != null) out = out.slice(0, max);
                    return single ? decorate(out[0] || null) : out.map(decorate);
                }
                return decorate(out);
            }).then(res, rej),
            catch: (rej) => q.then(undefined, rej),
        };
        return q;
    }

    const findAll = (q) => docs.filter((d) => matches(d, q));
    const first = (q) => findAll(q)[0] || null;

    const model = {
        modelName: name,
        docs,
        reset() { docs.splice(0); },
        insert(doc) {
            const d = normalize({ ...defaults, ...doc });
            if (!d._id) d._id = newId();
            docs.push(d);
            return d;
        },
        find: jest.fn((q = {}) => query(() => findAll(q))),
        findOne: jest.fn((q = {}) => query(() => findAll(q), { single: true })),
        findById: jest.fn((id) => query(() => docs.find((d) => eq(d._id, id)) || null)),
        exists: jest.fn((q) => query(() => (first(q) ? { _id: first(q)._id } : null))),
        create: jest.fn(async (doc) => decorate(model.insert(doc))),
        updateOne: jest.fn(async (q, update, opts = {}) => {
            const d = first(q);
            if (!d) {
                if (opts.upsert) { const nd = model.insert({}); applyUpdate(nd, update, q, { inserting: true }); return { matchedCount: 0, upsertedCount: 1 }; }
                return { matchedCount: 0, modifiedCount: 0 };
            }
            applyUpdate(d, update, q);
            return { matchedCount: 1, modifiedCount: 1 };
        }),
        updateMany: jest.fn(async (q, update) => {
            const hits = findAll(q);
            hits.forEach((d) => applyUpdate(d, update, q));
            return { matchedCount: hits.length, modifiedCount: hits.length };
        }),
        findOneAndUpdate: jest.fn((q, update, opts = {}) => query(() => {
            let d = first(q);
            if (!d) {
                if (!opts.upsert) return null;
                d = model.insert({});
                applyUpdate(d, update, q, { inserting: true });
                return opts.new === false ? null : d;
            }
            const before = clone(d);
            applyUpdate(d, update, q);
            return opts.new ? d : before;
        })),
        findByIdAndUpdate: jest.fn((id, update, opts = {}) => model.findOneAndUpdate({ _id: id }, update, opts)),
        deleteOne: jest.fn(async (q) => {
            const i = docs.findIndex((d) => matches(d, q));
            if (i >= 0) docs.splice(i, 1);
            return { deletedCount: i >= 0 ? 1 : 0 };
        }),
        countDocuments: jest.fn(async (q) => findAll(q).length),
    };
    return model;
}

module.exports = { createCollection, matches, applyUpdate, normalize };
