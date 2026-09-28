'use strict';

/**
 * Workspace knowledge for Oruinwan AI: meaning-based search over the notes,
 * tasks and knowledge pages of a workspace, using embeddings from the
 * Oruinwan engine (config.models.embed). Messages are end-to-end encrypted and
 * are never indexed.
 *
 * The index is per workspace and kept fresh lazily: before a search, changed
 * or new items are (re)embedded within a small time budget and the rest is
 * finished in the background. Every search filters by what the asking user
 * may see, and `shared` searches (answers posted into a conversation) only use
 * sources everyone there can see.
 *
 * Scoring happens in-process, which is fine for thousands of chunks per
 * workspace; a vector index (e.g. MongoDB Atlas Vector Search) can replace
 * `rank()` when workspaces grow far beyond that.
 */

const mongoose = require('mongoose');
const AIEmbedding = require('../../models/AIEmbedding');
const Note = require('../../../models/Note');
const Task = require('../../../models/Task');
const Channel = require('../channels/channel.model.js');
const aiConfig = require('../../../../ai/config');
const { createProvider } = require('../../../../ai/providers');
const logger = require('../../../utils/logger');

let KnowledgePage = null;
try { KnowledgePage = require('../knowledge/KnowledgePage'); } catch { /* optional module */ }

const CHUNK_CHARS = 900;
const CHUNK_OVERLAP = 120;
const BATCH = 32;
const SYNC_BUDGET_CHUNKS = 96; // embedded before answering; the rest continues in the background
const MIN_SCORE = 0.55;

const oid = (v) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);

let engine = null;
function embedder() {
    if (!engine) engine = createProvider('local_llm');
    return engine;
}

/** Strip markup and collapse whitespace. */
function plain(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function chunk(text) {
    const t = plain(text);
    if (t.length <= CHUNK_CHARS) return t ? [t] : [];
    const out = [];
    for (let i = 0; i < t.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
        out.push(t.slice(i, i + CHUNK_CHARS));
        if (i + CHUNK_CHARS >= t.length) break;
    }
    return out;
}

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Every indexable item of a workspace with the text to embed. */
async function workspaceSources(workspaceId) {
    const ws = oid(workspaceId);
    const [notes, tasks, pages] = await Promise.all([
        Note.find({ workspace: ws, isArchived: { $ne: true } }).select('title content updatedAt').lean(),
        Task.find({ workspace: ws, deleted: { $ne: true } }).select('title description status priority dueDate updatedAt').lean(),
        KnowledgePage ? KnowledgePage.find({ workspaceId: ws, isDeleted: { $ne: true } }).select('title content updatedAt').lean() : [],
    ]);
    return [
        ...notes.map((n) => ({ kind: 'note', ref: n._id, title: n.title || 'Untitled note', updatedAt: n.updatedAt, text: `${n.title || ''}\n${n.content || ''}` })),
        ...tasks.map((t) => ({
            kind: 'task', ref: t._id, title: t.title, updatedAt: t.updatedAt,
            text: [`Task: ${t.title}`, t.description, `Status: ${t.status}`, t.priority && `Priority: ${t.priority}`, t.dueDate && `Due: ${fmtDate(t.dueDate)}`].filter(Boolean).join('\n'),
        })),
        ...pages.map((p) => ({ kind: 'knowledge', ref: p._id, title: p.title, updatedAt: p.updatedAt, text: `${p.title}\n${p.content || ''}` })),
    ];
}

const syncing = new Map(); // workspaceId -> Promise

/**
 * Bring the workspace index up to date. Embeds at most `budget` chunks, then
 * (unless `background` is false) keeps going in the background.
 * @returns {Promise<{ indexed: number, pending: number }>}
 */
async function syncWorkspace(workspaceId, { budget = SYNC_BUDGET_CHUNKS, background = true } = {}) {
    const key = String(workspaceId);
    if (syncing.has(key)) return syncing.get(key);
    const run = (async () => {
        const ws = oid(workspaceId);
        const model = aiConfig.models.embed;
        const sources = await workspaceSources(workspaceId);
        const existing = await AIEmbedding.aggregate([
            { $match: { workspace: ws } },
            { $group: { _id: { kind: '$kind', ref: '$ref' }, at: { $min: '$sourceUpdatedAt' }, model: { $first: '$model' } } },
        ]);
        const known = new Map(existing.map((e) => [`${e._id.kind}:${e._id.ref}`, e]));
        const live = new Set(sources.map((s) => `${s.kind}:${s.ref}`));

        // Drop chunks whose source was deleted or archived.
        const gone = existing.filter((e) => !live.has(`${e._id.kind}:${e._id.ref}`)).map((e) => e._id.ref);
        if (gone.length) await AIEmbedding.deleteMany({ workspace: ws, ref: { $in: gone } });

        const stale = sources.filter((s) => {
            const e = known.get(`${s.kind}:${s.ref}`);
            return !e || e.model !== model || new Date(e.at) < new Date(s.updatedAt);
        });

        let indexed = 0;
        let i = 0;
        for (; i < stale.length && indexed < budget; i += 1) {
            const s = stale[i];
            const parts = chunk(s.text);
            await AIEmbedding.deleteMany({ workspace: ws, kind: s.kind, ref: s.ref });
            for (let j = 0; j < parts.length; j += BATCH) {
                const slice = parts.slice(j, j + BATCH);
                const vectors = await embedder().embed(slice.map((p) => `search_document: ${p}`), { model });
                await AIEmbedding.insertMany(slice.map((text, k) => ({
                    workspace: ws, kind: s.kind, ref: s.ref, chunk: j + k, title: s.title, text, vector: vectors[k], model, sourceUpdatedAt: s.updatedAt,
                })), { ordered: false });
                indexed += slice.length;
            }
        }
        return { indexed, pending: stale.length - i };
    })();
    syncing.set(key, run);
    try {
        const result = await run;
        if (result.pending > 0 && background) {
            setImmediate(() => syncWorkspace(workspaceId, { budget: 1000, background: true })
                .catch((err) => logger.warn({ err }, '[AI knowledge] background indexing failed')));
        }
        return result;
    } finally {
        syncing.delete(key);
    }
}

/**
 * Ids of the sources a user may see. `shared` restricts to what everyone in a
 * conversation can see (workspace-visible tasks, the channel's tasks, public
 * notes, knowledge pages), for answers posted into that conversation.
 */
async function visibleRefs(workspaceId, userId, { shared = false, channelId = null } = {}) {
    const ws = oid(workspaceId);
    const uid = oid(userId);
    let taskFilter;
    let noteFilter;
    if (shared) {
        taskFilter = { $or: [{ visibility: 'workspace' }, ...(channelId ? [{ visibility: 'channel', channel: oid(channelId) }] : [])] };
        noteFilter = { isPublic: true };
    } else {
        const myChannels = await Channel.find({ workspace: ws, 'members.user': uid }).select('_id').lean();
        taskFilter = { $or: [
            { visibility: 'workspace' },
            { visibility: 'channel', channel: { $in: myChannels.map((c) => c._id) } },
            { createdBy: uid },
            { assignedTo: uid },
        ] };
        noteFilter = { $or: [{ owner: uid }, { sharedWith: uid }, { isPublic: true }] };
    }
    const [notes, tasks, pages] = await Promise.all([
        Note.find({ workspace: ws, isArchived: { $ne: true }, ...noteFilter }).select('_id').lean(),
        Task.find({ workspace: ws, deleted: { $ne: true }, ...taskFilter }).select('_id').lean(),
        KnowledgePage ? KnowledgePage.find({ workspaceId: ws, isDeleted: { $ne: true } }).select('_id').lean() : [],
    ]);
    return [...notes, ...tasks, ...pages].map((d) => d._id);
}

function cosine(a, b) {
    let dot = 0; let na = 0; let nb = 0;
    for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Best chunk per source, above the score threshold, highest first. */
function rank(rows, queryVector, query, { k, minScore }) {
    const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const best = new Map();
    for (const r of rows) {
        let score = cosine(queryVector, r.vector);
        if (words.some((w) => r.title.toLowerCase().includes(w))) score += 0.05; // small boost for title hits
        const key = `${r.kind}:${r.ref}`;
        if (!best.has(key) || best.get(key).score < score) best.set(key, { ...r, score });
    }
    return [...best.values()].filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Search a workspace's knowledge on behalf of a user.
 * @returns {Promise<Array<{ type, id, title, snippet, score }>>}
 */
async function search(workspaceId, userId, query, { k = 5, minScore = MIN_SCORE, shared = false, channelId = null } = {}) {
    if (!oid(workspaceId) || !String(query || '').trim()) return [];
    await syncWorkspace(workspaceId);
    const refs = await visibleRefs(workspaceId, userId, { shared, channelId });
    if (!refs.length) return [];
    const rows = await AIEmbedding.find({ workspace: oid(workspaceId), ref: { $in: refs } }).select('kind ref title text vector').lean();
    if (!rows.length) return [];
    const [queryVector] = await embedder().embed([`search_query: ${String(query).slice(0, 1000)}`], { model: aiConfig.models.embed });
    return rank(rows, queryVector, query, { k, minScore }).map((r) => ({
        type: r.kind, id: String(r.ref), title: r.title, snippet: r.text.slice(0, 600), score: Number(r.score.toFixed(3)),
    }));
}

/** Best-effort search for grounding answers: never throws, returns [] when unavailable. */
async function contextFor(workspaceId, userId, query, opts = {}) {
    if (String(query || '').trim().length < 12) return [];
    try {
        return await search(workspaceId, userId, query, { k: 4, ...opts });
    } catch (err) {
        logger.warn({ err: err.message }, '[AI knowledge] search unavailable');
        return [];
    }
}

module.exports = { search, contextFor, syncWorkspace, visibleRefs, chunk, plain, rank, cosine };
