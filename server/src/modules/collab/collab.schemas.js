'use strict';

/**
 * How each collaborative document is laid out inside its Y.Doc, and how it maps
 * to the plain content the rest of the app stores (search, AI, versions, REST).
 *
 *   note        Y.Array 'blocks' of Y.Map { id: string, type: string, content: Y.Text, meta: object|null }
 *               <-> Note.content = JSON.stringify([{ id, type, content, meta }])
 *               (legacy HTML / plain content seeds a single 'text' block)
 *   knowledge   Y.Text 'content' (markdown) <-> KnowledgePage.content
 *   whiteboard  Y.Array 'strokes' of plain objects { id, tool, color, lineWidth, points: [{x,y}] }
 *               <-> Whiteboard.strokes
 *
 * Every schema has seed(doc, value), read(doc) -> value, and replace(doc, value)
 * which edits the live doc in place (one transaction, minimal diff) so a REST
 * write lands in connected editors as an ordinary update.
 */

const Y = require('yjs');

const SERVER_ORIGIN = 'server';

/** Replace the text of a Y.Text with `next` by deleting/inserting only the changed middle. */
function diffReplaceText(ytext, next) {
    const prev = ytext.toString();
    next = String(next ?? '');
    if (prev === next) return;
    let start = 0;
    const max = Math.min(prev.length, next.length);
    while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
    let endPrev = prev.length;
    let endNext = next.length;
    while (endPrev > start && endNext > start && prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)) {
        endPrev--;
        endNext--;
    }
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
}

// ── note ─────────────────────────────────────────────────────────────────────

let blockSeq = 0;
function newBlockId() {
    blockSeq = (blockSeq + 1) % 1e6;
    return `b${Date.now().toString(36)}${blockSeq.toString(36)}`;
}

/** Note.content (JSON block array or legacy HTML/plain text) -> array of plain blocks. */
function parseNoteContent(content) {
    const raw = typeof content === 'string' ? content : '';
    if (!raw.trim()) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(b => b && typeof b === 'object' && !Array.isArray(b))
                .map(b => ({
                    id: typeof b.id === 'string' && b.id ? b.id : newBlockId(),
                    type: typeof b.type === 'string' && b.type ? b.type : 'text',
                    content: typeof b.content === 'string' ? b.content : (b.content == null ? '' : String(b.content)),
                    meta: b.meta && typeof b.meta === 'object' ? b.meta : null,
                }));
        }
    } catch { /* legacy content */ }
    return [{ id: newBlockId(), type: 'text', content: raw, meta: null }];
}

function blockToYMap(block) {
    const m = new Y.Map();
    m.set('id', block.id);
    m.set('type', block.type);
    const text = new Y.Text();
    text.insert(0, block.content || '');
    m.set('content', text);
    m.set('meta', block.meta || null);
    return m;
}

function yMapToBlock(m) {
    if (!(m instanceof Y.Map)) return null;
    const content = m.get('content');
    return {
        id: String(m.get('id') || ''),
        type: String(m.get('type') || 'text'),
        content: content instanceof Y.Text ? content.toString() : (typeof content === 'string' ? content : ''),
        meta: m.get('meta') ?? null,
    };
}

const note = {
    seed(doc, content) {
        const blocks = parseNoteContent(content);
        if (!blocks.length) return;
        const arr = doc.getArray('blocks');
        doc.transact(() => arr.insert(0, blocks.map(blockToYMap)), SERVER_ORIGIN);
    },
    /** Plain block array. */
    blocks(doc) {
        return doc.getArray('blocks').toArray().map(yMapToBlock).filter(Boolean);
    },
    /** String stored in Note.content (same shape the REST API takes). */
    read(doc) {
        const blocks = note.blocks(doc);
        return blocks.length ? JSON.stringify(blocks) : '';
    },
    replace(doc, content) {
        const next = parseNoteContent(content);
        const arr = doc.getArray('blocks');
        doc.transact(() => {
            const current = arr.toArray();
            const sameShape = current.length === next.length
                && current.every((m, i) => m instanceof Y.Map && m.get('id') === next[i].id);
            if (!sameShape) {
                if (arr.length) arr.delete(0, arr.length);
                if (next.length) arr.insert(0, next.map(blockToYMap));
                return;
            }
            current.forEach((m, i) => {
                const b = next[i];
                if (m.get('type') !== b.type) m.set('type', b.type);
                if (JSON.stringify(m.get('meta') ?? null) !== JSON.stringify(b.meta ?? null)) m.set('meta', b.meta ?? null);
                let text = m.get('content');
                if (!(text instanceof Y.Text)) {
                    text = new Y.Text();
                    m.set('content', text);
                }
                diffReplaceText(text, b.content);
            });
        }, SERVER_ORIGIN);
    },
};

// ── knowledge ────────────────────────────────────────────────────────────────

const knowledge = {
    seed(doc, content) {
        const text = typeof content === 'string' ? content : '';
        if (text) doc.transact(() => doc.getText('content').insert(0, text), SERVER_ORIGIN);
    },
    read(doc) {
        return doc.getText('content').toString();
    },
    replace(doc, content) {
        doc.transact(() => diffReplaceText(doc.getText('content'), content), SERVER_ORIGIN);
    },
};

// ── whiteboard ───────────────────────────────────────────────────────────────

let strokeSeq = 0;
function normaliseStroke(s) {
    if (!s || typeof s !== 'object') return null;
    strokeSeq = (strokeSeq + 1) % 1e6;
    const points = Array.isArray(s.points)
        ? s.points.filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
            .map(p => ({ x: Number(p.x), y: Number(p.y) }))
        : [];
    return {
        id: typeof s.id === 'string' && s.id ? s.id : `s${Date.now().toString(36)}${strokeSeq.toString(36)}`,
        tool: typeof s.tool === 'string' ? s.tool : 'pen',
        color: typeof s.color === 'string' ? s.color : '#FFFFFF',
        lineWidth: Number.isFinite(Number(s.lineWidth)) ? Number(s.lineWidth) : 3,
        points,
    };
}

const whiteboard = {
    seed(doc, strokes) {
        const list = (Array.isArray(strokes) ? strokes : []).map(normaliseStroke).filter(Boolean);
        if (list.length) doc.transact(() => doc.getArray('strokes').insert(0, list), SERVER_ORIGIN);
    },
    read(doc) {
        return doc.getArray('strokes').toArray().map(normaliseStroke).filter(Boolean);
    },
    replace(doc, strokes) {
        const list = (Array.isArray(strokes) ? strokes : []).map(normaliseStroke).filter(Boolean);
        const arr = doc.getArray('strokes');
        doc.transact(() => {
            if (arr.length) arr.delete(0, arr.length);
            if (list.length) arr.insert(0, list);
        }, SERVER_ORIGIN);
    },
};

const SCHEMAS = { note, knowledge, whiteboard };

module.exports = { SCHEMAS, SERVER_ORIGIN, diffReplaceText, parseNoteContent, normaliseStroke };
