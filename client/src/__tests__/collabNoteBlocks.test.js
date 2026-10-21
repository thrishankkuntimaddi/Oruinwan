import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applyBlocksToY, readBlocks, LOCAL_ORIGIN } from '../lib/collab/noteBlocks';

const b = (id, content = '', type = 'text', meta = {}) => ({ id, type, content, meta });

function docWith(blocks) {
    const doc = new Y.Doc();
    doc.transact(() => applyBlocksToY(doc.getArray('blocks'), blocks), LOCAL_ORIGIN);
    return doc;
}

function countOps(doc, fn) {
    let inserted = 0;
    let deleted = 0;
    const arr = doc.getArray('blocks');
    const obs = (e) => e.changes.delta.forEach((op) => {
        if (op.insert) inserted += op.insert.length;
        if (op.delete) deleted += op.delete;
    });
    arr.observe(obs);
    fn();
    arr.unobserve(obs);
    return { inserted, deleted };
}

describe('note blocks ⇄ Y.Doc', () => {
    it('writes and reads the documented layout (Y.Map with Y.Text content)', () => {
        const doc = docWith([b('a', '<b>Hi</b>'), b('h', 'Title', 'heading', { level: 2 })]);
        const first = doc.getArray('blocks').get(0);
        expect(first).toBeInstanceOf(Y.Map);
        expect(first.get('content')).toBeInstanceOf(Y.Text);
        expect(readBlocks(doc.getArray('blocks'))).toEqual([
            b('a', '<b>Hi</b>'), b('h', 'Title', 'heading', { level: 2 }),
        ]);
    });

    it('edits only the text of a changed block', () => {
        const doc = docWith([b('a', 'one'), b('b', 'two')]);
        const ops = countOps(doc, () => doc.transact(() => applyBlocksToY(doc.getArray('blocks'), [b('a', 'one!'), b('b', 'two')])));
        expect(ops).toEqual({ inserted: 0, deleted: 0 });
        expect(readBlocks(doc.getArray('blocks'))[0].content).toBe('one!');
    });

    it('inserts, deletes, changes type and meta', () => {
        const doc = docWith([b('a', 'x'), b('b', 'y'), b('c', 'z')]);
        const arr = doc.getArray('blocks');
        doc.transact(() => applyBlocksToY(arr, [b('a', 'x'), b('n', 'new'), b('c', 'z', 'code', { lang: 'go' })]));
        expect(readBlocks(arr)).toEqual([b('a', 'x'), b('n', 'new'), b('c', 'z', 'code', { lang: 'go' })]);
    });

    it('moves a block down or up with one re-insert', () => {
        const doc = docWith([b('a', '1'), b('b', '2'), b('c', '3')]);
        const arr = doc.getArray('blocks');
        let ops = countOps(doc, () => doc.transact(() => applyBlocksToY(arr, [b('b', '2'), b('c', '3'), b('a', '1')])));
        expect(readBlocks(arr).map((x) => x.id)).toEqual(['b', 'c', 'a']);
        expect(ops).toEqual({ inserted: 1, deleted: 1 });

        ops = countOps(doc, () => doc.transact(() => applyBlocksToY(arr, [b('a', '1'), b('b', '2'), b('c', '3')])));
        expect(readBlocks(arr).map((x) => x.id)).toEqual(['a', 'b', 'c']);
        expect(ops).toEqual({ inserted: 1, deleted: 1 });
    });

    it('merges two people typing in different blocks', () => {
        const a = docWith([b('1', 'alpha'), b('2', 'beta')]);
        const other = new Y.Doc();
        Y.applyUpdate(other, Y.encodeStateAsUpdate(a));

        a.transact(() => applyBlocksToY(a.getArray('blocks'), [b('1', 'alpha one'), b('2', 'beta')]));
        other.transact(() => applyBlocksToY(other.getArray('blocks'), [b('1', 'alpha'), b('2', 'beta two'), b('3', 'gamma')]));
        Y.applyUpdate(a, Y.encodeStateAsUpdate(other));
        Y.applyUpdate(other, Y.encodeStateAsUpdate(a));

        const expected = [b('1', 'alpha one'), b('2', 'beta two'), b('3', 'gamma')];
        expect(readBlocks(a.getArray('blocks'))).toEqual(expected);
        expect(readBlocks(other.getArray('blocks'))).toEqual(expected);
    });

    it('tolerates a plain-string content value', () => {
        const doc = new Y.Doc();
        const arr = doc.getArray('blocks');
        const m = new Y.Map();
        arr.push([m]);
        m.set('id', 'x'); m.set('type', 'text'); m.set('content', 'plain'); m.set('meta', null);
        expect(readBlocks(arr)).toEqual([b('x', 'plain')]);
        doc.transact(() => applyBlocksToY(arr, [b('x', 'plainer')]));
        expect(arr.get(0).get('content')).toBeInstanceOf(Y.Text);
        expect(readBlocks(arr)[0].content).toBe('plainer');
    });
});
