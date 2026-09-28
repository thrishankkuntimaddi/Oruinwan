'use strict';

const { applyOp, actionItems, initialBlocks, notesTitle, parseBlocks, NoteOpError } = require('../huddleNotes');

describe('huddle notes operations', () => {
  const base = () => initialBlocks();

  test('a new paragraph goes before the action items, with escaped text', () => {
    const { blocks, applied } = applyOp(base(), { kind: 'paragraph', id: 'p1', text: 'Ship <b>it</b>\nnext line' }, { author: 'alice' });
    const idx = blocks.findIndex((b) => b.id === 'p1');
    const actions = blocks.findIndex((b) => b.meta?.huddleActionsHeading);
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(actions);
    expect(blocks[idx]).toMatchObject({ type: 'text', content: 'Ship &lt;b&gt;it&lt;/b&gt;<br>next line', meta: { author: 'alice' } });
    expect(applied).toMatchObject({ kind: 'paragraph', id: 'p1', created: true });
  });

  test('edits to different paragraphs both survive (no whole-note overwrite)', () => {
    let blocks = base();
    blocks = applyOp(blocks, { kind: 'paragraph', id: 'a', text: 'alice' }).blocks;
    blocks = applyOp(blocks, { kind: 'paragraph', id: 'b', text: 'bob', afterId: 'a' }).blocks;
    // Both edit their own paragraph "at the same time": applied one after the other.
    blocks = applyOp(blocks, { kind: 'paragraph', id: 'a', text: 'alice edited' }).blocks;
    blocks = applyOp(blocks, { kind: 'paragraph', id: 'b', text: 'bob edited' }).blocks;
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.content);
    expect(text).toEqual(expect.arrayContaining(['alice edited', 'bob edited']));
    expect(blocks.findIndex((b) => b.id === 'b')).toBe(blocks.findIndex((b) => b.id === 'a') + 1);
  });

  test('action items are upserted and removed one by one', () => {
    let blocks = base();
    blocks = applyOp(blocks, { kind: 'action', item: { id: 'x1', text: 'Write spec' } }, { author: 'alice' }).blocks;
    blocks = applyOp(blocks, { kind: 'action', item: { id: 'x2', text: 'Book room' } }).blocks;
    const { blocks: b2, applied } = applyOp(blocks, { kind: 'action', item: { id: 'x1', done: true, taskId: 'a'.repeat(24) } });
    expect(applied.item).toMatchObject({ id: 'x1', text: 'Write spec', done: true, taskId: 'a'.repeat(24), author: 'alice' });
    const content = JSON.stringify(b2);
    expect(actionItems(content).map((i) => i.id)).toEqual(['x1', 'x2']);
    const b3 = applyOp(b2, { kind: 'action_remove', id: 'x2' }).blocks;
    expect(actionItems(JSON.stringify(b3)).map((i) => i.text)).toEqual(['Write spec']);
  });

  test('the action list is recreated if someone deleted it in the Notes editor', () => {
    const blocks = [{ id: 'q', type: 'text', content: 'hi', meta: {} }];
    const out = applyOp(blocks, { kind: 'action', item: { id: 'n1', text: 'Follow up' } }).blocks;
    expect(actionItems(JSON.stringify(out))).toHaveLength(1);
  });

  test('bad input is refused', () => {
    expect(() => applyOp(base(), { kind: 'paragraph', id: '../x', text: 'a' })).toThrow(NoteOpError);
    expect(() => applyOp(base(), { kind: 'paragraph', id: 'huddle-heading', text: 'a' })).toThrow('Only text blocks');
    expect(() => applyOp(base(), { kind: 'nope' })).toThrow('Unknown operation');
    expect(applyOp(base(), { kind: 'action', item: { id: 'z', taskId: 'not-an-id' } }).applied.item.taskId).toBeNull();
  });

  test('titles and legacy content', () => {
    expect(notesTitle({ channelName: 'design', startedAt: '2026-09-28T10:00:00Z' })).toBe('Huddle notes — #design — Sep 28, 2026');
    expect(notesTitle({})).toMatch(/^Huddle notes — Workspace huddle — /);
    expect(parseBlocks('<p>old</p>')).toEqual([{ id: 'legacy', type: 'text', content: '<p>old</p>', meta: {} }]);
  });
});
