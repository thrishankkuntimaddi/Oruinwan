'use strict';

/**
 * Workspace knowledge for Oruinwan AI: meaning-based search over the notes,
 * tasks and knowledge pages of a workspace, using embeddings from the
 * Oruinwan engine (config.models.embed). Messages are end-to-end encrypted and
 * are never indexed.
 *
 * The index lives in PostgreSQL (ai_embeddings, pgvector, see
 * db/migrations/0003_ai_embeddings.sql). It is per workspace and kept fresh
 * lazily: before a search, changed or new items are (re)embedded within a
 * small budget and the rest is finished in the background. Every search
 * filters by what the asking user may see, and `shared` searches (answers
 * posted into a conversation) only use sources everyone there can see.
 *
 * Nearest-neighbour scoring is done by pgvector (cosine, HNSW index) with the
 * workspace and the visible sources filtered in SQL first. Without
 * DATABASE_URL knowledge search is off and returns nothing.
 */

const mongoose = require('mongoose');
const Note = require('../../../models/Note');
const Tasks = require('../tasks/tasks.query');
const Channel = require('../channels/channel.model.js');
const aiConfig = require('../../../../ai/config');
const { createProvider } = require('../../../../ai/providers');
const logger = require('../../../utils/logger');
const pg = require('../../shared/postgres');

let KnowledgePage = null;
try { KnowledgePage = require('../knowledge/KnowledgePage'); } catch { /* optional module */ }

const CHUNK_CHARS = 900;
const CHUNK_OVERLAP = 120;
const BATCH = 32;
const SYNC_BUDGET_CHUNKS = 96; // embedded before answering; the rest continues in the background
const MIN_SCORE = 0.55;
// The embedding column is vector(768) (nomic-embed-text). A model with another
// size needs a migration that alters the column; vectors of the wrong size are skipped.
const EMBEDDING_DIMS = 768;

const oid = (v) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const sid = (v) => String(v);

let engine = null;
function embedder() {
    if (!engine) engine = createProvider('local_llm');
    return engine;
}

let warnedDisabled = false;
function enabled() {
    if (pg.isPostgresEnabled()) return true;
    if (!warnedDisabled) {
        warnedDisabled = true;
        logger.warn('[AI knowledge] DATABASE_URL not set — knowledge search is off');
    }
    return false;
}

/** pgvector text form of a vector: '[0.1,0.2,...]'. */
const vec = (v) => `[${v.join(',')}]`;

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
        Tasks.find({ workspace: ws, deleted: { $ne: true } }, { select: 'title description status priority dueDate updatedAt' }),
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

/** What the index already holds, one row per source: oldest chunk timestamp and model. */
async function indexedSources(workspaceId) {
    const { rows } = await pg.query(
        `SELECT kind, ref_id AS ref, MIN(source_updated_at) AS at, MIN(model) AS model
           FROM ai_embeddings WHERE workspace_id = $1 GROUP BY kind, ref_id`,
        [sid(workspaceId)]
    );
    return rows;
}

/** Replace one source's chunks atomically: delete, then insert the new rows. */
async function replaceSource(workspaceId, s, parts, vectors, model) {
    await pg.withTransaction(async (tx) => {
        await tx.query('DELETE FROM ai_embeddings WHERE workspace_id = $1 AND kind = $2 AND ref_id = $3', [sid(workspaceId), s.kind, sid(s.ref)]);
        for (let k = 0; k < parts.length; k += 1) {
            const v = vectors[k];
            if (!Array.isArray(v) || v.length !== EMBEDDING_DIMS) {
                logger.error(`[AI knowledge] embedding from model "${model}" has ${v?.length ?? 0} dimensions, column expects ${EMBEDDING_DIMS}; chunk skipped (a different model needs a column migration)`);
                continue;
            }
            await tx.query(
                `INSERT INTO ai_embeddings (workspace_id, kind, ref_id, chunk, title, text, embedding, model, source_updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9)
                 ON CONFLICT (workspace_id, kind, ref_id, chunk) DO UPDATE
                   SET title = EXCLUDED.title, text = EXCLUDED.text, embedding = EXCLUDED.embedding,
                       model = EXCLUDED.model, source_updated_at = EXCLUDED.source_updated_at`,
                [sid(workspaceId), s.kind, sid(s.ref), k, s.title || '', parts[k], vec(v), model, s.updatedAt || new Date()]
            );
        }
    });
}

const syncing = new Map(); // workspaceId -> Promise

/**
 * Bring the workspace index up to date. Embeds at most `budget` chunks, then
 * (unless `background` is false) keeps going in the background.
 * @returns {Promise<{ indexed: number, pending: number }>}
 */
async function syncWorkspace(workspaceId, { budget = SYNC_BUDGET_CHUNKS, background = true } = {}) {
    if (!enabled()) return { indexed: 0, pending: 0 };
    const key = String(workspaceId);
    if (syncing.has(key)) return syncing.get(key);
    const run = (async () => {
        const model = aiConfig.models.embed;
        const sources = await workspaceSources(workspaceId);
        const existing = await indexedSources(workspaceId);
        const known = new Map(existing.map((e) => [`${e.kind}:${e.ref}`, e]));
        const live = new Set(sources.map((s) => `${s.kind}:${s.ref}`));

        // Drop chunks whose source was deleted or archived.
        const gone = existing.filter((e) => !live.has(`${e.kind}:${e.ref}`)).map((e) => e.ref);
        if (gone.length) await pg.query('DELETE FROM ai_embeddings WHERE workspace_id = $1 AND ref_id = ANY($2)', [key, gone]);

        const stale = sources.filter((s) => {
            const e = known.get(`${s.kind}:${s.ref}`);
            return !e || e.model !== model || new Date(e.at) < new Date(s.updatedAt);
        });

        let indexed = 0;
        let i = 0;
        for (; i < stale.length && indexed < budget; i += 1) {
            const s = stale[i];
            const parts = chunk(s.text);
            const vectors = [];
            for (let j = 0; j < parts.length; j += BATCH) {
                const slice = parts.slice(j, j + BATCH);
                vectors.push(...await embedder().embed(slice.map((p) => `search_document: ${p}`), { model }));
            }
            await replaceSource(workspaceId, s, parts, vectors, model);
            indexed += parts.length;
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

/** Remove every chunk of the given sources (e.g. notes deleted with an account). */
async function forgetSources(kind, refs) {
    if (!enabled() || !refs?.length) return 0;
    const r = await pg.query('DELETE FROM ai_embeddings WHERE kind = $1 AND ref_id = ANY($2)', [kind, refs.map(sid)]);
    return r.rowCount || 0;
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
        Tasks.find({ workspace: ws, deleted: { $ne: true }, ...taskFilter }, { select: '_id' }),
        KnowledgePage ? KnowledgePage.find({ workspaceId: ws, isDeleted: { $ne: true } }).select('_id').lean() : [],
    ]);
    return [...notes, ...tasks, ...pages].map((d) => d._id);
}

function cosine(a, b) {
    let dot = 0; let na = 0; let nb = 0;
    for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Best chunk per source, above the score threshold, highest first. Rows carry
 * the pgvector similarity in `score`; a row without one (tests, legacy
 * callers) is scored in-process against `queryVector`.
 */
function rank(rows, queryVector, query, { k, minScore }) {
    const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const best = new Map();
    for (const r of rows) {
        let score = typeof r.score === 'number' ? r.score : cosine(queryVector, r.vector);
        if (words.some((w) => String(r.title || '').toLowerCase().includes(w))) score += 0.05; // small boost for title hits
        const key = `${r.kind}:${r.ref}`;
        if (!best.has(key) || best.get(key).score < score) best.set(key, { ...r, score });
    }
    return [...best.values()].filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Nearest chunks for a query, restricted to the workspace and the visible
 * sources, scored by pgvector (cosine similarity in `score`).
 */
async function candidates(workspaceId, refs, queryVector, k) {
    const limit = Math.max(k * 4, 20);
    const { rows } = await pg.query(
        `SELECT kind, ref_id AS ref, title, text, 1 - (embedding <=> $1::vector) AS score
           FROM ai_embeddings
          WHERE workspace_id = $2 AND ref_id = ANY($3)
          ORDER BY embedding <=> $1::vector
          LIMIT $4`,
        [vec(queryVector), sid(workspaceId), refs.map(sid), limit]
    );
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
}

/**
 * Search a workspace's knowledge on behalf of a user.
 * @returns {Promise<Array<{ type, id, title, snippet, score }>>}
 */
async function search(workspaceId, userId, query, { k = 5, minScore = MIN_SCORE, shared = false, channelId = null } = {}) {
    if (!enabled() || !oid(workspaceId) || !String(query || '').trim()) return [];
    await syncWorkspace(workspaceId);
    const refs = await visibleRefs(workspaceId, userId, { shared, channelId });
    if (!refs.length) return [];
    const [queryVector] = await embedder().embed([`search_query: ${String(query).slice(0, 1000)}`], { model: aiConfig.models.embed });
    const rows = await candidates(workspaceId, refs, queryVector, k);
    if (!rows.length) return [];
    return rank(rows, queryVector, query, { k, minScore }).map((r) => ({
        type: r.kind, id: String(r.ref), title: r.title, snippet: r.text.slice(0, 600), score: Number(r.score.toFixed(3)),
    }));
}

/** Best-effort search for grounding answers: never throws, returns [] when unavailable. */
async function contextFor(workspaceId, userId, query, opts = {}) {
    if (!enabled() || String(query || '').trim().length < 12) return [];
    try {
        return await search(workspaceId, userId, query, { k: 4, ...opts });
    } catch (err) {
        logger.warn({ err: err.message }, '[AI knowledge] search unavailable');
        return [];
    }
}

module.exports = { search, contextFor, syncWorkspace, forgetSources, visibleRefs, chunk, plain, rank, cosine, candidates, EMBEDDING_DIMS };
