'use strict';

/**
 * A tiny in-memory stand-in for a mongoose model, enough for service tests:
 * create / find / findOne / findById / countDocuments / updateMany / bulkWrite
 * / aggregate($match + $group count). Ids are compared as strings; queries
 * support equality, $in, $or and dotted paths through arrays.
 */

const mongoose = require('mongoose');

const s = (v) => (v == null ? v : String(v?._id ?? v));
const clone = (v) => JSON.parse(JSON.stringify(v));

function values(doc, path) {
    const parts = path.split('.');
    let cur = [doc];
    for (const p of parts) {
        const next = [];
        for (const c of cur) {
            if (c == null) continue;
            const v = c[p];
            if (Array.isArray(v)) next.push(...v); else next.push(v);
        }
        cur = next;
    }
    return cur;
}

function matches(doc, q) {
    return Object.entries(q || {}).every(([k, cond]) => {
        if (k === '$or') return cond.some((sub) => matches(doc, sub));
        const vals = values(doc, k);
        if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !mongoose.isValidObjectId(cond)) {
            if ('$in' in cond) return vals.some((v) => cond.$in.map(s).includes(s(v)));
            return false;
        }
        if (cond === null) return vals.length === 0 || vals.some((v) => v == null);
        if (typeof cond === 'boolean') return vals.some((v) => v === cond) || (cond === false && vals.every((v) => v == null));
        return vals.some((v) => s(v) === s(cond));
    });
}

function makeFakeModel(defaults = {}) {
    let rows = [];
    let seq = 0;

    function hydrateDoc(row) {
        const doc = row;
        Object.defineProperty(doc, 'save', { value: jest.fn(async () => { doc.updatedAt = new Date(); return doc; }), enumerable: false, configurable: true });
        Object.defineProperty(doc, 'toObject', { value: () => clone(doc), enumerable: false, configurable: true });
        Object.defineProperty(doc, 'markModified', { value: () => {}, enumerable: false, configurable: true });
        return doc;
    }

    function query(result) {
        let out = result;
        const q = {
            select: () => q,
            sort: (spec) => {
                if (Array.isArray(out)) {
                    const [[key, dir]] = Object.entries(spec);
                    out = [...out].sort((a, b) => ((a[key] ?? 0) > (b[key] ?? 0) ? dir : (a[key] ?? 0) < (b[key] ?? 0) ? -dir : 0));
                }
                return q;
            },
            limit: (n) => { if (Array.isArray(out)) out = out.slice(0, n); return q; },
            populate: () => q,
            lean: () => { out = out == null ? out : clone(out); return q; },
            then: (res, rej) => Promise.resolve(out).then(res, rej),
            catch: (rej) => Promise.resolve(out).catch(rej),
        };
        return q;
    }

    const model = {
        _rows: () => rows,
        reset() { rows = []; seq = 0; },
        seed(docs) { for (const d of docs) model._insert(d); },
        _insert(data) {
            seq += 1;
            const now = new Date(Date.now() + seq);
            const row = hydrateDoc({
                ...clone(defaults),
                ...clone(data),
                _id: s(data._id) || new mongoose.Types.ObjectId().toString(),
                createdAt: now,
                updatedAt: now,
            });
            // Sub-documents in arrays get ids like mongoose does.
            for (const v of Object.values(row)) {
                if (Array.isArray(v)) v.forEach((el) => { if (el && typeof el === 'object' && el._id === undefined && el.body !== undefined) el._id = new mongoose.Types.ObjectId().toString(); });
            }
            const origPush = Array.prototype.push;
            for (const [k, v] of Object.entries(row)) {
                if (Array.isArray(v) && k === 'replies') {
                    v.push = function (...items) {
                        items.forEach((el) => { el._id = el._id || new mongoose.Types.ObjectId().toString(); el.createdAt = new Date(); });
                        return origPush.apply(this, items);
                    };
                }
            }
            rows.push(row);
            return row;
        },
        create: jest.fn(async (data) => model._insert(data)),
        find: jest.fn((q) => query(rows.filter((r) => matches(r, q)))),
        findOne: jest.fn((q) => query(rows.find((r) => matches(r, q)) || null)),
        findById: jest.fn((id) => query(rows.find((r) => s(r._id) === s(id)) || null)),
        countDocuments: jest.fn(async (q) => rows.filter((r) => matches(r, q)).length),
        updateMany: jest.fn(async (q, update) => {
            const set = update.$set || update;
            const hit = rows.filter((r) => matches(r, q));
            hit.forEach((r) => Object.assign(r, clone(set)));
            return { modifiedCount: hit.length };
        }),
        bulkWrite: jest.fn(async (ops) => {
            for (const op of ops) {
                const { filter, update } = op.updateOne;
                rows.filter((r) => matches(r, filter)).forEach((r) => Object.assign(r, update.$set));
            }
            return { ok: 1 };
        }),
        aggregate: jest.fn(async (pipeline) => {
            const match = pipeline.find((p) => p.$match)?.$match || {};
            const group = pipeline.find((p) => p.$group)?.$group;
            const hit = rows.filter((r) => matches(r, match));
            const key = group._id.replace('$', '');
            const by = new Map();
            for (const r of hit) {
                const k = s(r[key]);
                const g = by.get(k) || { _id: k, total: 0, open: 0 };
                g.total += 1;
                if (!r.resolved) g.open += 1;
                by.set(k, g);
            }
            return [...by.values()];
        }),
    };
    return model;
}

module.exports = { makeFakeModel, matches };
