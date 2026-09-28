'use strict';

/**
 * Shared huddle notes: pure helpers over the Notes block format
 * (`[{ id, type, content, meta }]`, see features/notes/notes.sanitize.js).
 *
 * Everyone in a huddle edits the same Note. Instead of saving the whole note
 * (last write wins), the huddle panel sends small operations — one paragraph,
 * or one action item — and the server applies them to the stored blocks one
 * at a time. Two people typing in different paragraphs never overwrite each
 * other; two people typing in the same paragraph still resolve last-write-wins
 * for that paragraph.
 */

const ACTIONS_BLOCK_ID = 'huddle-actions';
const MAX_BLOCKS = 400;
const MAX_ACTIONS = 200;
const MAX_TEXT = 8000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Plain text (one paragraph, may contain newlines) -> the HTML a Notes text block stores. */
function textToHtml(text) {
    return escapeHtml(String(text || '').slice(0, MAX_TEXT)).replace(/\r?\n/g, '<br>');
}

function formatDate(d) {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Huddle notes — #design — Sep 28, 2026" */
function notesTitle({ channelName, title, startedAt } = {}) {
    const where = channelName ? `#${String(channelName).replace(/^#\s*/, '')}` : (title || 'Workspace huddle');
    return `Huddle notes — ${where} — ${formatDate(startedAt)}`;
}

function initialBlocks() {
    return [
        { id: 'huddle-heading', type: 'heading', content: 'Discussion', meta: { level: 3 } },
        { id: `p-${Date.now().toString(36)}`, type: 'text', content: '', meta: {} },
        { id: ACTIONS_BLOCK_ID, type: 'heading', content: 'Action items', meta: { level: 3, huddleActionsHeading: true } },
        { id: `${ACTIONS_BLOCK_ID}-list`, type: 'checklist', content: '[]', meta: { huddleActions: true } },
    ];
}

function parseBlocks(content) {
    if (!content) return [];
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed.filter((b) => b && typeof b === 'object');
    } catch { /* legacy HTML content */ }
    return [{ id: 'legacy', type: 'text', content: String(content), meta: {} }];
}

function parseItems(content) {
    try {
        const items = JSON.parse(content || '[]');
        return Array.isArray(items) ? items.filter((i) => i && typeof i === 'object') : [];
    } catch {
        return [];
    }
}

function actionsBlock(blocks) {
    return blocks.find((b) => b.type === 'checklist' && b.meta?.huddleActions)
        || blocks.find((b) => String(b.id) === `${ACTIONS_BLOCK_ID}-list`) || null;
}

class NoteOpError extends Error {
    constructor(message) { super(message); this.status = 400; }
}

function cleanId(id) {
    const s = String(id ?? '');
    if (!ID_RE.test(s)) throw new NoteOpError('Invalid id');
    return s;
}

function cleanItem(raw, existing = {}) {
    const item = { ...existing, id: cleanId(raw.id) };
    if (raw.text !== undefined) item.text = String(raw.text).slice(0, 500);
    if (raw.done !== undefined) item.done = raw.done === true;
    if (raw.taskId !== undefined) item.taskId = raw.taskId && /^[a-f\d]{24}$/i.test(String(raw.taskId)) ? String(raw.taskId) : null;
    if (raw.assigneeId !== undefined) item.assigneeId = raw.assigneeId && /^[a-f\d]{24}$/i.test(String(raw.assigneeId)) ? String(raw.assigneeId) : null;
    if (item.text === undefined) item.text = '';
    if (item.done === undefined) item.done = false;
    return item;
}

/**
 * Apply one operation to the note's blocks. Returns { blocks, applied } where
 * `applied` is what to broadcast (with server-normalised values).
 *
 * Ops:
 *   { kind: 'paragraph', id, text, afterId? }  create or replace a text block
 *   { kind: 'remove', id }                      remove a text block
 *   { kind: 'action', item: { id, text?, done?, taskId?, assigneeId? } }  upsert an action item
 *   { kind: 'action_remove', id }               remove an action item
 */
function applyOp(blocks, op, { author } = {}) {
    if (!op || typeof op !== 'object') throw new NoteOpError('Missing operation');
    const next = blocks.map((b) => ({ ...b }));

    if (op.kind === 'paragraph') {
        const id = cleanId(op.id);
        const content = textToHtml(op.text);
        const idx = next.findIndex((b) => String(b.id) === id);
        if (idx >= 0) {
            if (next[idx].type !== 'text') throw new NoteOpError('Only text blocks can be edited here');
            next[idx] = { ...next[idx], content, meta: { ...(next[idx].meta || {}), editedBy: author || null } };
            return { blocks: next, applied: { kind: 'paragraph', id, content } };
        }
        if (next.length >= MAX_BLOCKS) throw new NoteOpError('These notes are full');
        const block = { id, type: 'text', content, meta: { author: author || null } };
        let at = -1;
        if (op.afterId != null) at = next.findIndex((b) => String(b.id) === String(op.afterId));
        if (at < 0) {
            // New paragraphs go before the action items section by default.
            const actionsHeading = next.findIndex((b) => b.meta?.huddleActionsHeading || String(b.id) === ACTIONS_BLOCK_ID);
            at = actionsHeading >= 0 ? actionsHeading - 1 : next.length - 1;
        }
        next.splice(at + 1, 0, block);
        return { blocks: next, applied: { kind: 'paragraph', id, content, afterId: at >= 0 ? String(next[at].id) : null, created: true, author: author || null } };
    }

    if (op.kind === 'remove') {
        const id = cleanId(op.id);
        const idx = next.findIndex((b) => String(b.id) === id);
        if (idx < 0) return { blocks: next, applied: { kind: 'remove', id } };
        if (next[idx].type !== 'text') throw new NoteOpError('Only text blocks can be removed here');
        next.splice(idx, 1);
        return { blocks: next, applied: { kind: 'remove', id } };
    }

    if (op.kind === 'action' || op.kind === 'action_remove') {
        let block = actionsBlock(next);
        if (!block) {
            next.push({ id: ACTIONS_BLOCK_ID, type: 'heading', content: 'Action items', meta: { level: 3, huddleActionsHeading: true } });
            block = { id: `${ACTIONS_BLOCK_ID}-list`, type: 'checklist', content: '[]', meta: { huddleActions: true } };
            next.push(block);
        }
        const bi = next.indexOf(block);
        const items = parseItems(block.content);
        if (op.kind === 'action_remove') {
            const id = cleanId(op.id);
            next[bi] = { ...block, content: JSON.stringify(items.filter((i) => String(i.id) !== id)) };
            return { blocks: next, applied: { kind: 'action_remove', id } };
        }
        if (!op.item || typeof op.item !== 'object') throw new NoteOpError('Missing action item');
        const id = cleanId(op.item.id);
        const i = items.findIndex((x) => String(x.id) === id);
        if (i < 0 && items.length >= MAX_ACTIONS) throw new NoteOpError('Too many action items');
        const item = cleanItem(op.item, i >= 0 ? items[i] : { author: author || null });
        if (i >= 0) items[i] = item; else items.push(item);
        next[bi] = { ...block, content: JSON.stringify(items) };
        return { blocks: next, applied: { kind: 'action', item } };
    }

    throw new NoteOpError('Unknown operation');
}

/** Action items of a note's content (for wrap-up summaries). */
function actionItems(content) {
    const block = actionsBlock(parseBlocks(content));
    return block ? parseItems(block.content) : [];
}

module.exports = {
    ACTIONS_BLOCK_ID,
    NoteOpError,
    applyOp,
    actionItems,
    initialBlocks,
    notesTitle,
    parseBlocks,
    textToHtml,
};
