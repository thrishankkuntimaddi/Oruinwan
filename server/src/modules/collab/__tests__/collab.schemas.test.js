'use strict';

const Y = require('yjs');
const { SCHEMAS, diffReplaceText, parseNoteContent } = require('../collab.schemas');

describe('collab schemas', () => {
    test('diffReplaceText edits only the changed middle', () => {
        const doc = new Y.Doc();
        const text = doc.getText('t');
        text.insert(0, 'hello brave world');
        const ops = [];
        text.observe((e) => ops.push(e.delta));
        doc.transact(() => diffReplaceText(text, 'hello new world'));
        expect(text.toString()).toBe('hello new world');
        expect(ops[0][0]).toEqual({ retain: 6 });
        expect(ops[0].slice(1)).toEqual(expect.arrayContaining([{ delete: 5 }, { insert: 'new' }]));
        diffReplaceText(text, 'hello new world');
        expect(ops).toHaveLength(1);
    });

    test('note: JSON block content round-trips through the Y.Doc', () => {
        const blocks = [
            { id: 'a', type: 'heading', content: 'Title', meta: { level: 1 } },
            { id: 'b', type: 'text', content: '<b>Hi</b>', meta: null },
        ];
        const doc = new Y.Doc();
        SCHEMAS.note.seed(doc, JSON.stringify(blocks));
        expect(JSON.parse(SCHEMAS.note.read(doc))).toEqual(blocks);
        expect(doc.getArray('blocks').get(1).get('content')).toBeInstanceOf(Y.Text);
    });

    test('note: legacy HTML seeds one text block; empty content seeds nothing', () => {
        expect(parseNoteContent('<p>old</p>')).toEqual([expect.objectContaining({ type: 'text', content: '<p>old</p>' })]);
        const doc = new Y.Doc();
        SCHEMAS.note.seed(doc, '');
        expect(SCHEMAS.note.read(doc)).toBe('');
    });

    test('note: replace keeps block identity when ids match and rebuilds otherwise', () => {
        const doc = new Y.Doc();
        SCHEMAS.note.seed(doc, JSON.stringify([{ id: 'a', type: 'text', content: 'one' }]));
        const before = doc.getArray('blocks').get(0);
        SCHEMAS.note.replace(doc, JSON.stringify([{ id: 'a', type: 'text', content: 'one two' }]));
        expect(doc.getArray('blocks').get(0)).toBe(before);
        expect(JSON.parse(SCHEMAS.note.read(doc))[0].content).toBe('one two');

        SCHEMAS.note.replace(doc, JSON.stringify([{ id: 'x', type: 'code', content: 'c' }, { id: 'a', type: 'text', content: 'z' }]));
        expect(JSON.parse(SCHEMAS.note.read(doc)).map(b => b.id)).toEqual(['x', 'a']);
    });

    test('note: concurrent edits from two peers merge', () => {
        const a = new Y.Doc();
        SCHEMAS.note.seed(a, JSON.stringify([{ id: 'a', type: 'text', content: 'abc' }]));
        const b = new Y.Doc();
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
        a.getArray('blocks').get(0).get('content').insert(0, 'X');
        b.getArray('blocks').get(0).get('content').insert(3, 'Y');
        Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
        expect(JSON.parse(SCHEMAS.note.read(a))[0].content).toBe('XabcY');
        expect(SCHEMAS.note.read(b)).toBe(SCHEMAS.note.read(a));
    });

    test('knowledge: markdown text', () => {
        const doc = new Y.Doc();
        SCHEMAS.knowledge.seed(doc, '# Page');
        SCHEMAS.knowledge.replace(doc, '# Page\n\nbody');
        expect(SCHEMAS.knowledge.read(doc)).toBe('# Page\n\nbody');
    });

    test('whiteboard: strokes get ids and are normalised', () => {
        const doc = new Y.Doc();
        SCHEMAS.whiteboard.seed(doc, [{ color: '#000', points: [{ x: 1, y: 2 }, { x: 'bad' }] }]);
        const [s] = SCHEMAS.whiteboard.read(doc);
        expect(s).toEqual({ id: expect.any(String), tool: 'pen', color: '#000', lineWidth: 3, points: [{ x: 1, y: 2 }] });
        SCHEMAS.whiteboard.replace(doc, []);
        expect(SCHEMAS.whiteboard.read(doc)).toEqual([]);
    });
});
