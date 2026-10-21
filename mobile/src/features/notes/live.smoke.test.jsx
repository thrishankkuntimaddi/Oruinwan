// Live co-editing end to end against a fake collab server (a real Y.Doc speaking the
// y-protocols sync over a fake socket): the note editor and the knowledge page editor.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const me = { id: 'me', name: 'Me', username: 'me' };
const note = { id: 'n1', title: 'Plan', type: 'note', content: '<p>stale REST copy</p>', ownerId: 'me', sharedWith: [], visibility: 'private', updatedAt: new Date().toISOString() };
const page = { id: 'k1', title: 'Handbook', icon: '📘', content: '# Old', updatedAt: new Date().toISOString() };

const fake = {
  kind: 'live',
  note: vi.fn(async () => note),
  notes: vi.fn(async () => [note]),
  members: vi.fn(async () => [me]),
  updateNote: vi.fn(async (id, patch) => ({ ...note, ...patch })),
  page: vi.fn(async () => page),
  knowledge: vi.fn(async () => [page]),
  updatePage: vi.fn(async (id, patch) => ({ ...page, ...patch })),
};

/** A collab server for one document: answers joins, syncs, relays its own edits. */
function fakeServer(seed, { readOnly = false } = {}) {
  const sdoc = new Y.Doc();
  seed(sdoc);
  const handlers = new Map();
  let joined = null;
  const fire = (ev, payload) => queueMicrotask(() => (handlers.get(ev) || new Set()).forEach((fn) => fn(payload)));
  const socket = {
    connected: true,
    sent: [],
    on(ev, fn) {
      if (!handlers.has(ev)) handlers.set(ev, new Set());
      handlers.get(ev).add(fn);
    },
    off(ev, fn) {
      handlers.get(ev)?.delete(fn);
    },
    emit(ev, p, ack) {
      socket.sent.push(ev);
      if (ev === 'collab:join') {
        joined = { docType: p.docType, docId: p.docId };
        queueMicrotask(() => {
          ack({ ok: true, ...joined, readOnly });
          const enc = encoding.createEncoder();
          syncProtocol.writeSyncStep1(enc, sdoc);
          fire('collab:sync', { ...joined, msg: encoding.toUint8Array(enc) });
        });
      } else if (ev === 'collab:sync') {
        const enc = encoding.createEncoder();
        syncProtocol.readSyncMessage(decoding.createDecoder(p.msg), enc, sdoc, 'client');
        if (encoding.length(enc) > 0) fire('collab:sync', { ...joined, msg: encoding.toUint8Array(enc) });
      }
    },
  };
  sdoc.on('update', (u, origin) => {
    if (origin === 'client' || !joined) return;
    const enc = encoding.createEncoder();
    syncProtocol.writeUpdate(enc, u);
    fire('collab:sync', { ...joined, msg: encoding.toUint8Array(enc) });
  });
  /** Someone else opens the document. */
  const visitor = (user) => {
    const other = new awarenessProtocol.Awareness(new Y.Doc());
    other.setLocalStateField('user', user);
    fire('collab:awareness', { ...joined, msg: awarenessProtocol.encodeAwarenessUpdate(other, [other.clientID]) });
  };
  return { sdoc, socket, visitor };
}

let server = null;
vi.mock('../../data/live/realtime.js', () => ({ realtimeSocket: () => server?.socket || null }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: create(() => ({ user: me, workspaceId: 'w1' })),
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));

const { NoteScreen } = await import('./screens.jsx');
const { PageScreen } = await import('../knowledge/screens.jsx');
const { clearQueries } = await import('../../data/query.js');
const { closeAllCollab } = await import('../../lib/collab/useCollab.js');

function seedNote(doc) {
  const arr = doc.getArray('blocks');
  const m = new Y.Map();
  m.set('id', 'b1');
  m.set('type', 'text');
  const t = new Y.Text();
  t.insert(0, 'live text');
  m.set('content', t);
  m.set('meta', null);
  arr.push([m]);
}

beforeEach(() => {
  cleanup();
  closeAllCollab();
  clearQueries?.();
  vi.clearAllMocks();
});

describe('live note', () => {
  it('shows the shared document, sends edits as blocks and never PUTs content', async () => {
    server = fakeServer(seedNote);
    const { container } = render(<NoteScreen id="n1" />);
    const editor = await waitFor(() => {
      const el = container.querySelector('[data-placeholder]');
      expect(el.textContent).toBe('live text');
      return el;
    });
    expect(server.socket.sent[0]).toBe('collab:join');
    const p = editor.querySelector('[data-bid="b1"]');
    p.textContent = 'live text, edited on the phone';
    fireEvent.input(editor);
    await waitFor(() => expect(server.sdoc.getArray('blocks').get(0).get('content').toString()).toBe('live text, edited on the phone'));

    // Someone else types: it shows up.
    act(() => server.sdoc.getArray('blocks').get(0).get('content').insert(0, '» '));
    await waitFor(() => expect(editor.textContent).toBe('» live text, edited on the phone'));

    // Presence.
    act(() => server.visitor({ id: 'u2', name: 'Ana Silva' }));
    await waitFor(() => expect(screen.getByTestId('collab-presence').getAttribute('aria-label')).toMatch(/Ana Silva/));

    // Title still saves over REST, without content.
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Plan v2' } });
    await waitFor(() => expect(fake.updateNote).toHaveBeenCalled(), { timeout: 2000 });
    expect(fake.updateNote.mock.calls.every(([, patch]) => !('content' in patch))).toBe(true);
  });

  it('stays read-only when the server says so', async () => {
    server = fakeServer(seedNote, { readOnly: true });
    const { container } = render(<NoteScreen id="n1" />);
    await waitFor(() => expect(container.querySelector('[data-placeholder]').textContent).toBe('live text'));
    expect(container.querySelector('[data-placeholder]').getAttribute('contenteditable')).toBe('false');
    expect(screen.getByText('View only')).toBeTruthy();
  });
});

describe('live knowledge page', () => {
  it('binds the Markdown textarea to the shared text', async () => {
    server = fakeServer((doc) => doc.getText('content').insert(0, '# Live'));
    render(<PageScreen id="k1" edit />);
    const area = await waitFor(() => {
      const el = screen.getByLabelText('Page content');
      expect(el.value).toBe('# Live');
      return el;
    });
    area.value = '# Live\n\nNew line';
    fireEvent.input(area);
    await waitFor(() => expect(server.sdoc.getText('content').toString()).toBe('# Live\n\nNew line'));
    act(() => server.sdoc.getText('content').insert(0, 'Intro\n'));
    await waitFor(() => expect(screen.getByLabelText('Page content').value).toBe('Intro\n# Live\n\nNew line'));
  });

  it('falls back to REST saves when there is no socket', async () => {
    server = null;
    render(<PageScreen id="k1" edit />);
    const area = await screen.findByLabelText('Page content');
    expect(area.value).toBe('# Old');
    fireEvent.change(area, { target: { value: '# Old!' } });
    await waitFor(() => expect(fake.updatePage).toHaveBeenCalledWith('k1', expect.objectContaining({ content: '# Old!' })), { timeout: 2000 });
  });
});
