import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { diffText, applyTextDiff, transformIndex, transformIndexByDelta } from '../lib/collab/textDiff';
import { strokeHit, roundPoint } from '../lib/collab/whiteboardStrokes';

describe('diffText', () => {
    it('returns null for equal strings', () => {
        expect(diffText('abc', 'abc')).toBeNull();
        expect(diffText(null, '')).toBeNull();
    });

    it('finds a typed character', () => {
        expect(diffText('helo', 'hello')).toEqual({ index: 3, remove: 0, insert: 'l' });
    });

    it('finds a deletion and a replacement', () => {
        expect(diffText('hello world', 'hello')).toEqual({ index: 5, remove: 6, insert: '' });
        expect(diffText('the cat sat', 'the dog sat')).toEqual({ index: 4, remove: 3, insert: 'dog' });
    });

    it('does not split an emoji', () => {
        const d = diffText('a😀b', 'a😃b');
        const out = 'a😀b'.slice(0, d.index) + d.insert + 'a😀b'.slice(d.index + d.remove);
        expect(out).toBe('a😃b');
        expect(d.remove).toBe(2);
    });
});

describe('applyTextDiff', () => {
    it('edits a Y.Text minimally so concurrent edits survive', () => {
        const a = new Y.Doc();
        const b = new Y.Doc();
        a.getText('t').insert(0, 'hello world');
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

        // A edits the start, B the end, at the same time.
        a.transact(() => applyTextDiff(a.getText('t'), 'Hello world'));
        b.transact(() => applyTextDiff(b.getText('t'), 'hello world!'));
        Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

        expect(a.getText('t').toString()).toBe('Hello world!');
        expect(b.getText('t').toString()).toBe('Hello world!');
    });

    it('reports whether anything changed', () => {
        const d = new Y.Doc();
        const t = d.getText('t');
        expect(applyTextDiff(t, '')).toBe(false);
        expect(applyTextDiff(t, 'x')).toBe(true);
        expect(t.toString()).toBe('x');
    });
});

describe('caret transforms', () => {
    it('moves a caret through a diff', () => {
        const d = diffText('abcdef', 'abXYcdef'); // insert at 2
        expect(transformIndex(1, d)).toBe(1);
        expect(transformIndex(4, d)).toBe(6);
        const del = diffText('abcdef', 'af'); // delete 1..5
        expect(transformIndex(3, del)).toBe(1);
        expect(transformIndex(6, del)).toBe(2);
    });

    it('moves a caret through a Yjs delta from a remote edit', () => {
        const doc = new Y.Doc();
        const t = doc.getText('t');
        t.insert(0, 'hello world');
        let delta = null;
        t.observe((e) => { delta = e.changes.delta; });

        t.insert(0, '>> ');
        expect(transformIndexByDelta(5, delta)).toBe(8);

        t.delete(0, 3);
        expect(transformIndexByDelta(8, delta)).toBe(5);

        t.insert(11, '!');
        expect(transformIndexByDelta(5, delta)).toBe(5);

        t.delete(2, 6); // remove "llo wo" around a caret at 4
        expect(transformIndexByDelta(4, delta)).toBe(2);
    });
});

describe('whiteboard strokes', () => {
    const stroke = { id: 's1', lineWidth: 2, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    it('hits a stroke near its line and misses far away', () => {
        expect(strokeHit(stroke, { x: 50, y: 5 }, 8)).toBe(true);
        expect(strokeHit(stroke, { x: 50, y: 40 }, 8)).toBe(false);
        expect(strokeHit({ points: [{ x: 10, y: 10 }] }, { x: 12, y: 11 }, 5)).toBe(true);
        expect(strokeHit({ points: [] }, { x: 0, y: 0 })).toBe(false);
    });
    it('rounds points to one decimal', () => {
        expect(roundPoint({ x: 1.234, y: 9.876 })).toEqual({ x: 1.2, y: 9.9 });
    });
});
