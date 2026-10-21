import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { caretShift, diffRange, diffReplaceText, transformIndex } from './textOps.js';
import { LOCAL_ORIGIN, TextareaBinding } from './TextareaBinding.js';
import { applyLocal, blockHtml, blocksFromY, readEditor, renderBlocks } from './noteBlocks.js';
import { collabReducer, collabView, initialCollabState, peersFrom } from './state.js';
import { CollabProvider } from './provider.js';

/** Two docs kept in sync like two editors through the server. */
function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on('update', (u, origin) => origin !== 'remote' && Y.applyUpdate(b, u, 'remote'));
  b.on('update', (u, origin) => origin !== 'remote' && Y.applyUpdate(a, u, 'remote'));
  return [a, b];
}

function seedBlocks(doc, blocks) {
  const arr = doc.getArray('blocks');
  doc.transact(() => {
    arr.insert(
      0,
      blocks.map((b) => {
        const m = new Y.Map();
        m.set('id', b.id);
        m.set('type', b.type);
        const t = new Y.Text();
        t.insert(0, b.content);
        m.set('content', t);
        m.set('meta', b.meta ?? null);
        return m;
      }),
    );
  }, 'server');
  return arr;
}

describe('text ops', () => {
  it('finds the changed middle', () => {
    expect(diffRange('hello world', 'hello brave world')).toEqual({ index: 6, remove: 0, insert: 'brave ' });
    expect(diffRange('abc', 'abc')).toBeNull();
    expect(diffRange('abcdef', 'abef')).toEqual({ index: 2, remove: 2, insert: '' });
  });

  it('edits a Y.Text minimally', () => {
    const doc = new Y.Doc();
    const t = doc.getText('content');
    t.insert(0, 'one two three');
    const deltas = [];
    t.observe((e) => deltas.push(e.delta));
    diffReplaceText(t, 'one 2 three');
    expect(t.toString()).toBe('one 2 three');
    expect(deltas).toHaveLength(1); // one transaction
    expect(deltas[0][0]).toEqual({ retain: 4 }); // the shared prefix is kept
  });

  it('moves an index through a delta', () => {
    expect(transformIndex([{ retain: 3 }, { insert: 'ab' }], 5)).toBe(7);
    expect(transformIndex([{ retain: 3 }, { insert: 'ab' }], 2)).toBe(2);
    expect(transformIndex([{ retain: 3 }, { insert: 'ab' }], 3, true)).toBe(3);
    expect(transformIndex([{ retain: 3 }, { insert: 'ab' }], 3, false)).toBe(5);
    expect(transformIndex([{ retain: 2 }, { delete: 3 }], 4)).toBe(2);
    expect(transformIndex([{ retain: 2 }, { delete: 3 }], 10)).toBe(7);
  });

  it('shifts a caret by a text change', () => {
    expect(caretShift('hello', 'oh hello', 3)).toBe(6);
    expect(caretShift('hello', 'hello there', 3)).toBe(3);
    expect(caretShift('hello world', 'hello', 8)).toBe(5);
  });
});

function fakeTextarea() {
  return {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    setSelectionRange(s, e) {
      this.selectionStart = s;
      this.selectionEnd = e;
    },
  };
}

describe('TextareaBinding', () => {
  it('sends typing as minimal edits and shows remote edits with the caret kept', () => {
    const [a, b] = pair();
    a.getText('content').insert(0, '# Title\nbody');
    const el = fakeTextarea();
    const binding = new TextareaBinding(b.getText('content'), el);
    expect(el.value).toBe('# Title\nbody');

    el.value = '# Title\nbody text';
    binding.input();
    expect(a.getText('content').toString()).toBe('# Title\nbody text');

    el.setSelectionRange(12, 12); // after "body"
    a.getText('content').insert(0, 'Intro\n');
    expect(el.value).toBe('Intro\n# Title\nbody text');
    expect(el.selectionStart).toBe(18);
  });

  it('waits while composing and does not overwrite remote edits', () => {
    const [a, b] = pair();
    a.getText('content').insert(0, 'abc');
    const el = fakeTextarea();
    const binding = new TextareaBinding(b.getText('content'), el);
    binding.compositionStart();
    a.getText('content').insert(0, 'XY'); // remote, not shown yet
    expect(el.value).toBe('abc');
    el.value = 'abcd'; // typing at the end of what the textarea shows
    binding.input();
    expect(b.getText('content').toString()).toBe('XYabcd');
    binding.compositionEnd();
    expect(el.value).toBe('XYabcd');
    expect(a.getText('content').toString()).toBe('XYabcd');
  });

  it('read-only puts the text back', () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'locked');
    const el = fakeTextarea();
    const binding = new TextareaBinding(doc.getText('content'), el, { readOnly: true });
    el.value = 'lockedX';
    binding.input();
    expect(el.value).toBe('locked');
    expect(doc.getText('content').toString()).toBe('locked');
  });
});

describe('note blocks', () => {
  const setup = (blocks) => {
    const doc = new Y.Doc();
    const arr = seedBlocks(doc, blocks);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const sigs = new WeakMap();
    let rendered = renderBlocks(root, blocksFromY(arr), sigs);
    const input = () => {
      const prev = new Map(blocksFromY(arr).map((b) => [b.id, b]));
      const items = readEditor(root, sigs, prev);
      doc.transact(() => applyLocal(arr, items, rendered), LOCAL_ORIGIN);
      rendered = new Set(items.map((i) => i.block.id));
    };
    return { doc, arr, root, sigs, input, rerender: () => (rendered = renderBlocks(root, blocksFromY(arr), sigs)) };
  };

  it('renders each block as one element with its id', () => {
    expect(blockHtml({ id: 'h', type: 'heading', content: 'A <b>', meta: { level: 2 } })).toBe('<h2 data-bid="h">A &lt;b&gt;</h2>');
    expect(blockHtml({ id: 'c', type: 'checklist', content: JSON.stringify([{ id: 1, text: 'x', done: true }]), meta: null })).toContain('data-checked="true"');
    expect(blockHtml({ id: 't', type: 'text', content: '<ul><li>one</li></ul>', meta: null })).toBe('<ul data-bid="t"><li>one</li></ul>');
    expect(blockHtml({ id: 'i', type: 'image', content: 'javascript:alert(1)', meta: null })).not.toContain('javascript');
  });

  it('writes only the edited block, in the web block format', () => {
    const { arr, root, input } = setup([
      { id: 'a', type: 'heading', content: 'Plan', meta: { level: 1 } },
      { id: 'b', type: 'text', content: 'first', meta: null },
      { id: 'c', type: 'table', content: '{"headers":["x"],"rows":[]}', meta: null },
    ]);
    expect(root.children).toHaveLength(3);
    expect(root.children[2].getAttribute('contenteditable')).toBe('false');
    root.children[1].innerHTML = 'first <strong>edit</strong>';
    input();
    const blocks = blocksFromY(arr);
    expect(blocks.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(blocks[1]).toEqual({ id: 'b', type: 'text', content: 'first <strong>edit</strong>', meta: null });
    expect(blocks[2].content).toBe('{"headers":["x"],"rows":[]}'); // read-only block untouched
  });

  it('keeps a legacy multi-paragraph HTML note as one block', () => {
    const html = '<p>a</p><ul data-type="checklist"><li data-checked="false">x</li></ul><p>b</p>';
    const { arr, root, input } = setup([{ id: 'legacy', type: 'text', content: html, meta: null }]);
    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild.tagName).toBe('DIV');
    root.querySelector('li').setAttribute('data-checked', 'true');
    input();
    const blocks = blocksFromY(arr);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe(html.replace('"false"', '"true"'));
  });

  it('gives a split paragraph (Enter copies the id) a new block after it', () => {
    const { arr, root, input } = setup([{ id: 'p', type: 'text', content: 'one two', meta: null }]);
    const copy = root.children[0].cloneNode(false);
    root.children[0].textContent = 'one';
    copy.textContent = 'two';
    root.appendChild(copy);
    input();
    const blocks = blocksFromY(arr);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ id: 'p', content: 'one' });
    expect(blocks[1].id).not.toBe('p');
    expect(blocks[1]).toMatchObject({ type: 'text', content: 'two' });
  });

  it('wraps loose typing into a text block', () => {
    const { arr, root, input } = setup([]);
    root.appendChild(document.createTextNode('hello'));
    input();
    expect(blocksFromY(arr)).toEqual([expect.objectContaining({ type: 'text', content: 'hello' })]);
    expect(root.firstElementChild.tagName).toBe('P');
  });

  it('never deletes a block someone else added that is not shown yet', () => {
    const { doc, arr, root, input } = setup([{ id: 'a', type: 'text', content: 'mine', meta: null }]);
    seedBlocks(doc, [{ id: 'z', type: 'text', content: 'theirs', meta: null }]); // remote, not rendered
    root.children[0].textContent = 'mine!';
    input();
    expect(blocksFromY(arr).map((b) => b.content)).toEqual(['theirs', 'mine!']);
  });

  it('re-renders only blocks that changed remotely and keeps checklist state', () => {
    const { arr, root, input, rerender } = setup([
      { id: 'a', type: 'text', content: 'keep', meta: null },
      { id: 'b', type: 'checklist', content: JSON.stringify([{ id: 1, text: 'buy milk', done: false }]), meta: null },
    ]);
    const first = root.children[0];
    root.querySelector('li').setAttribute('data-checked', 'true');
    input();
    expect(JSON.parse(blocksFromY(arr)[1].content)).toEqual([{ id: 1, text: 'buy milk', done: true }]);
    arr.get(1).get('content').insert(0, ''); // no-op
    const second = arr.get(0).get('content');
    second.insert(4, ' going');
    rerender();
    expect(root.children[0]).not.toBe(first);
    expect(root.children[0].textContent).toBe('keep going');
    expect(root.children).toHaveLength(2);
  });
});

describe('collab state', () => {
  it('goes live, offline and back', () => {
    let s = initialCollabState(true);
    expect(collabView(s).editable).toBe(false);
    s = collabReducer(s, { type: 'synced', readOnly: false });
    expect(s.mode).toBe('live');
    expect(collabView(s).editable).toBe(true);
    s = collabReducer(s, { type: 'status', status: 'offline' });
    expect(s.mode).toBe('live-offline');
    expect(collabView(s).editable).toBe(true);
    expect(collabView(s).banner).toMatch(/offline/i);
    s = collabReducer(s, { type: 'synced', readOnly: false });
    expect(s.mode).toBe('live');
  });

  it('is read-only offline before the first sync', () => {
    const s = initialCollabState(false);
    expect(s.mode).toBe('offline');
    expect(collabView(s).editable).toBe(false);
    expect(collabReducer(s, { type: 'status', status: 'connecting' }).mode).toBe('connecting');
  });

  it('falls back to REST on an older server, and closes on lost access', () => {
    const start = initialCollabState(true);
    expect(collabReducer(start, { type: 'error', code: 'NO_COLLAB' }).mode).toBe('rest');
    const live = collabReducer(start, { type: 'synced' });
    expect(collabReducer(live, { type: 'error', code: 'NO_COLLAB' }).mode).toBe('live');
    const closed = collabReducer(live, { type: 'closed', reason: 'revoked' });
    expect(closed.mode).toBe('closed');
    expect(collabView(closed, { kind: 'page' }).banner).toMatch(/no longer have access/);
    expect(collabView(collabReducer(live, { type: 'closed', reason: 'deleted' })).banner).toMatch(/deleted/);
    expect(collabReducer(live, { type: 'error', code: 'READ_ONLY' }).readOnly).toBe(true);
    expect(collabView(collabReducer(start, { type: 'synced', readOnly: true })).editable).toBe(false);
  });

  it('lists other people once each', () => {
    const states = new Map([
      [1, { user: { id: 'me', name: 'Me' } }],
      [2, { user: { id: 'u2', name: 'Ana', color: '#8a6f4e' } }],
      [3, { user: { id: 'u2', name: 'Ana' } }],
      [4, { user: { id: 'me', name: 'Me (web)' } }],
      [5, {}],
    ]);
    expect(peersFrom(states, 1, 'me')).toEqual([{ id: 'u2', name: 'Ana', color: '#8a6f4e', avatar: null }]);
  });
});

function fakeSocket(connected = true) {
  const handlers = new Map();
  return {
    connected,
    emitted: [],
    on(ev, fn) {
      handlers.set(ev, fn);
    },
    off(ev) {
      handlers.delete(ev);
    },
    emit(ev, payload, ack) {
      this.emitted.push({ ev, payload });
      this.ack = ack;
    },
    fire(ev, payload) {
      handlers.get(ev)?.(payload);
    },
  };
}

describe('CollabProvider (phone copy)', () => {
  it('joins, honours readOnly and leaves on destroy', () => {
    const socket = fakeSocket();
    const p = new CollabProvider(socket, 'note', 'n1', { user: { name: 'Me' } });
    expect(socket.emitted[0]).toMatchObject({ ev: 'collab:join', payload: { docType: 'note', docId: 'n1' } });
    socket.ack({ ok: true, readOnly: true });
    expect(p.readOnly).toBe(true);
    expect(socket.emitted.some((e) => e.ev === 'collab:sync')).toBe(true);
    const count = socket.emitted.length;
    p.doc.getArray('blocks').push(['x']); // local edit while read-only is not sent
    expect(socket.emitted.filter((e) => e.ev === 'collab:sync').length).toBe(socket.emitted.slice(0, count).filter((e) => e.ev === 'collab:sync').length);
    p.destroy();
    expect(socket.emitted.at(-1)).toMatchObject({ ev: 'collab:leave' });
  });

  it('reports NO_COLLAB when an older server never answers the join', () => {
    vi.useFakeTimers();
    const socket = fakeSocket();
    const p = new CollabProvider(socket, 'knowledge', 'k1', { joinTimeoutMs: 1000 });
    const errors = [];
    p.on('error', (e) => errors.push(e.code));
    vi.advanceTimersByTime(1001);
    expect(errors).toEqual(['NO_COLLAB']);
    p.destroy();
    vi.useRealTimers();
  });
});
