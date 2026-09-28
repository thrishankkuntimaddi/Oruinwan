'use strict';

/**
 * Personal memory for Oruinwan AI: short facts and preferences per user,
 * either global or scoped to one workspace. The user can list, add, edit and
 * delete them (Settings → AI); the assistant adds or removes them through the
 * remember/forget tools. Memories are only used in the user's private chats,
 * never in answers posted to shared conversations.
 */

const mongoose = require('mongoose');
const AIMemory = require('../../models/AIMemory');

const MAX_PER_USER = 100;
const MAX_TEXT = 500;
const PROMPT_LIMIT = 40;
const PROMPT_CHARS = 3000;

const oid = (v) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

function scopeFilter(userId, workspaceId) {
    const ws = oid(workspaceId);
    return { user: oid(userId), workspace: ws ? { $in: [null, ws] } : null };
}

const view = (m) => ({
    id: String(m._id),
    text: m.text,
    scope: m.workspace ? 'workspace' : 'everywhere',
    workspaceId: m.workspace ? String(m.workspace) : null,
    source: m.source,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
});

/** Memories visible in a workspace: global ones plus that workspace's. Newest first. */
async function list(userId, workspaceId) {
    const rows = await AIMemory.find(scopeFilter(userId, workspaceId)).sort({ updatedAt: -1 }).limit(MAX_PER_USER).lean();
    return rows.map(view);
}

/**
 * Save a memory. Exact duplicates (case-insensitive) are refreshed instead of
 * repeated. `scope: 'workspace'` ties it to `workspaceId`.
 */
async function add(userId, { text, scope = 'everywhere', workspaceId = null, source = 'user' }) {
    const value = clean(text);
    if (!value) throw Object.assign(new Error('Memory text is required'), { status: 400 });
    const workspace = scope === 'workspace' ? oid(workspaceId) : null;
    if (scope === 'workspace' && !workspace) throw Object.assign(new Error('workspaceId is required for a workspace memory'), { status: 400 });

    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await AIMemory.findOne({ user: oid(userId), workspace, text: new RegExp(`^${escaped}$`, 'i') });
    if (existing) {
        existing.updatedAt = new Date();
        await existing.save();
        return view(existing.toObject());
    }
    const count = await AIMemory.countDocuments({ user: oid(userId) });
    if (count >= MAX_PER_USER) {
        throw Object.assign(new Error(`You can keep up to ${MAX_PER_USER} memories. Delete some in Settings → AI first.`), { status: 409, code: 'AI_MEMORY_FULL' });
    }
    const doc = await AIMemory.create({ user: oid(userId), workspace, text: value, source });
    return view(doc.toObject());
}

async function update(userId, id, { text }) {
    const value = clean(text);
    if (!value) throw Object.assign(new Error('Memory text is required'), { status: 400 });
    const doc = await AIMemory.findOneAndUpdate({ _id: oid(id), user: oid(userId) }, { text: value }, { new: true }).lean();
    if (!doc) throw Object.assign(new Error('Memory not found'), { status: 404 });
    return view(doc);
}

async function remove(userId, id) {
    const res = await AIMemory.deleteOne({ _id: oid(id), user: oid(userId) });
    if (!res.deletedCount) throw Object.assign(new Error('Memory not found'), { status: 404 });
    return { ok: true };
}

/** Delete every memory of the user (optionally only one workspace's). */
async function clear(userId, { workspaceId } = {}) {
    const filter = { user: oid(userId) };
    if (workspaceId) filter.workspace = oid(workspaceId);
    const res = await AIMemory.deleteMany(filter);
    return { ok: true, deleted: res.deletedCount || 0 };
}

const STOPWORDS = new Set(['the', 'and', 'that', 'this', 'about', 'with', 'for', 'from', 'you', 'your', 'are', 'was', 'have', 'has', 'had', 'its', 'our', 'any', 'all', 'please', 'forget', 'remember', 'what', 'know']);
const stem = (w) => w.replace(/(ing|ers|er|es|s)$/, '');
const terms = (text) => [...new Set(clean(text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem))];

/**
 * Forget what a phrase refers to (used by the assistant's forget tool): the
 * memory sharing the most word stems with the phrase. With several equally good
 * matches every one of them is removed; with none, nothing is.
 */
async function forgetMatching(userId, workspaceId, phrase) {
    const wanted = terms(phrase);
    if (!wanted.length) return { ok: true, deleted: [] };
    const rows = await AIMemory.find(scopeFilter(userId, workspaceId)).lean();
    const scored = rows.map((m) => {
        const have = new Set(terms(m.text));
        return { m, score: wanted.filter((w) => have.has(w)).length };
    }).filter((x) => x.score > 0);
    if (!scored.length) return { ok: true, deleted: [] };
    const best = Math.max(...scored.map((x) => x.score));
    const hits = scored.filter((x) => x.score === best).map((x) => x.m);
    await AIMemory.deleteMany({ _id: { $in: hits.map((m) => m._id) } });
    return { ok: true, deleted: hits.map((m) => m.text) };
}

/** Lines for the assistant's system prompt (newest first, size-capped). */
async function promptLines(userId, workspaceId) {
    if (!oid(userId)) return [];
    const rows = await AIMemory.find(scopeFilter(userId, workspaceId)).sort({ updatedAt: -1 }).limit(PROMPT_LIMIT).select('text').lean();
    const out = [];
    let size = 0;
    for (const r of rows) {
        size += r.text.length;
        if (size > PROMPT_CHARS) break;
        out.push(r.text);
    }
    return out;
}

module.exports = { list, add, update, remove, clear, forgetMatching, promptLines, MAX_PER_USER };
