/**
 * Note blocks ⇄ Y.Doc (docs/api/collab.md, docType "note").
 *
 * doc.getArray('blocks') is a Y.Array of Y.Map { id, type, content: Y.Text, meta }.
 * The editor keeps a plain block list; `applyBlocksToY` turns each editor
 * change into the smallest set of Yjs operations, and `readBlocks` reads the
 * shared list back after someone else edits it.
 */
import * as Y from 'yjs';
import { applyTextDiff } from './textDiff';

/** Transaction origin for edits made in this tab. */
export const LOCAL_ORIGIN = 'collab-local';

const idOf = (m) => String(m.get('id'));

function contentString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value.toString === 'function') return value.toString();
    return String(value);
}

/** Plain block list from the shared array. */
export function readBlocks(yBlocks) {
    return yBlocks.toArray()
        .filter((m) => m instanceof Y.Map)
        .map((m) => ({
            id: m.get('id'),
            type: m.get('type') || 'text',
            content: contentString(m.get('content')),
            meta: m.get('meta') || {},
        }));
}

function makeYBlock(block) {
    const m = new Y.Map();
    m.set('id', String(block.id));
    m.set('type', block.type || 'text');
    m.set('content', new Y.Text(String(block.content ?? '')));
    m.set('meta', block.meta || {});
    return m;
}

const sameMeta = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

function updateYBlock(m, block) {
    if ((m.get('type') || 'text') !== (block.type || 'text')) m.set('type', block.type || 'text');
    const next = String(block.content ?? '');
    const ytext = m.get('content');
    if (ytext instanceof Y.Text) applyTextDiff(ytext, next);
    else m.set('content', new Y.Text(next));
    if (!sameMeta(m.get('meta'), block.meta)) m.set('meta', block.meta || {});
}

/**
 * Make the shared block array match `next` with minimal operations:
 * removed blocks are deleted, new ones inserted, text changes become
 * Y.Text range edits, and a moved block is re-inserted at its new place.
 * Wrap the call in `doc.transact(() => applyBlocksToY(arr, next), LOCAL_ORIGIN)`.
 */
export function applyBlocksToY(yBlocks, next) {
    const wanted = new Set(next.map((b) => String(b.id)));

    for (let i = yBlocks.length - 1; i >= 0; i--) {
        const m = yBlocks.get(i);
        if (!(m instanceof Y.Map) || !wanted.has(idOf(m))) yBlocks.delete(i, 1);
    }

    for (let i = 0; i < next.length; i++) {
        const block = next[i];
        const bid = String(block.id);
        const cur = i < yBlocks.length ? yBlocks.get(i) : null;
        if (cur && idOf(cur) === bid) { updateYBlock(cur, block); continue; }

        let from = -1;
        for (let k = i + 1; k < yBlocks.length; k++) {
            if (idOf(yBlocks.get(k)) === bid) { from = k; break; }
        }
        // `cur` only shifted down because `block` moved up from below: pull `block` up.
        // Otherwise `cur` moved further down: drop it here, it is re-created at its new place.
        if (cur && from !== -1 && next[i + 1] && String(next[i + 1].id) === idOf(cur)) {
            yBlocks.delete(from, 1);
            yBlocks.insert(i, [makeYBlock(block)]);
        } else if (cur && from !== -1) {
            yBlocks.delete(i, 1);
            i--; // compare the same target position again
        } else {
            yBlocks.insert(i, [makeYBlock(block)]);
        }
    }

    if (yBlocks.length > next.length) yBlocks.delete(next.length, yBlocks.length - next.length);
}
