// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// ── A tiny in-memory collab server speaking docs/api/collab.md ──────────────
function createServer({ joinResult } = {}) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    const sockets = new Set();
    const send = (s, event, msg) => s.receive(event, { docType: 'x', docId: 'x', ...s.key, msg });

    doc.on('update', (update, origin) => {
        sockets.forEach((s) => {
            if (s === origin || !s.joined) return;
            const enc = encoding.createEncoder();
            syncProtocol.writeUpdate(enc, update);
            send(s, 'collab:sync', encoding.toUint8Array(enc));
        });
    });

    return {
        doc,
        sockets,
        handle(socket, event, payload, ack) {
            if (event === 'collab:join') {
                const res = joinResult || { ok: true, readOnly: false };
                socket.key = { docType: payload.docType, docId: payload.docId };
                ack(res.ok ? { ...res, docType: payload.docType, docId: payload.docId } : res);
                if (!res.ok) return;
                socket.joined = true;
                const enc = encoding.createEncoder();
                syncProtocol.writeSyncStep1(enc, doc);
                send(socket, 'collab:sync', encoding.toUint8Array(enc));
            } else if (event === 'collab:sync') {
                const enc = encoding.createEncoder();
                syncProtocol.readSyncMessage(decoding.createDecoder(payload.msg), enc, doc, socket);
                if (encoding.length(enc) > 0) send(socket, 'collab:sync', encoding.toUint8Array(enc));
            } else if (event === 'collab:awareness') {
                sockets.forEach((s) => { if (s !== socket && s.joined) send(s, 'collab:awareness', payload.msg); });
            } else if (event === 'collab:leave') {
                socket.joined = false;
            }
        },
        saved() { sockets.forEach((s) => s.joined && s.receive('collab:saved', { ...s.key, savedAt: '2026-10-21T10:00:00Z' })); },
    };
}

function createSocket(server) {
    const handlers = new Map();
    const socket = {
        connected: true,
        joined: false,
        key: {},
        on(ev, fn) { if (!handlers.has(ev)) handlers.set(ev, new Set()); handlers.get(ev).add(fn); },
        off(ev, fn) { handlers.get(ev)?.delete(fn); },
        emit(ev, payload, ack) { server.handle(socket, ev, payload, ack); },
        receive(ev, payload) { (handlers.get(ev) || []).forEach((fn) => fn(payload)); },
    };
    server.sockets.add(socket);
    return socket;
}

// ── Mocks: the app socket comes from SocketContext ─────────────────────────
vi.mock('../contexts/SocketContext', async () => {
    const R = await import('react');
    const TestSocketCtx = R.createContext(null);
    const useOptionalSocket = () => {
        const socket = R.useContext(TestSocketCtx);
        return socket ? { socket } : null;
    };
    return { TestSocketCtx, useOptionalSocket, useSocket: () => useOptionalSocket() || { socket: null } };
});
vi.mock('@services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { strokes: [] } })), post: vi.fn(() => Promise.resolve({ data: {} })) } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { useCollabDoc, collabLabel } from '../lib/collab/useCollabDoc';
import CollabPresence from '../lib/collab/CollabPresence';
import Whiteboard from '../components/meetingsComp/Whiteboard';
import { TestSocketCtx } from '../contexts/SocketContext';

function Probe({ socket, label }) {
    return <TestSocketCtx.Provider value={socket}><ProbeInner label={label} /></TestSocketCtx.Provider>;
}

/** Test editor: a knowledge-style text bound to the shared Y.Text. */
function ProbeInner({ label }) {
    const live = useCollabDoc('knowledge', 'page1');
    const [text, setText] = React.useState('');
    React.useEffect(() => {
        if (!live.live) return undefined;
        const t = live.doc.getText('content');
        const pull = () => setText(t.toString());
        pull();
        t.observe(pull);
        return () => t.unobserve(pull);
    }, [live.live, live.doc]);
    return (
        <div data-testid={label}>
            <span data-testid={`${label}-state`}>{collabLabel(live)}</span>
            <span data-testid={`${label}-text`}>{text}</span>
            <span data-testid={`${label}-peers`}>{live.peers.map((p) => p.name).join(',')}</span>
            <button type="button" onClick={() => live.doc.getText('content').insert(0, `${label}!`)}>type-{label}</button>
            <CollabPresence collab={live} />
        </div>
    );
}

beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
});
afterEach(() => { cleanup(); });

describe('useCollabDoc against the collab protocol', () => {
    it('syncs the server doc, relays edits both ways and reports Saved', async () => {
        const server = createServer();
        server.doc.getText('content').insert(0, 'seeded by server');
        const s1 = createSocket(server);
        const s2 = createSocket(server);

        render(<><Probe socket={s1} label="a" /></>);
        await waitFor(() => expect(screen.getByTestId('a-text')).toHaveTextContent('seeded by server'));
        expect(screen.getByTestId('a-state')).toHaveTextContent('live');
        expect(screen.getByText('Live')).toBeInTheDocument();

        render(<Probe socket={s2} label="b" />);
        await waitFor(() => expect(screen.getByTestId('b-text')).toHaveTextContent('seeded by server'));

        fireEvent.click(screen.getByText('type-a'));
        await waitFor(() => expect(screen.getByTestId('b-text')).toHaveTextContent('a!seeded by server'));
        expect(server.doc.getText('content').toString()).toBe('a!seeded by server');
        // Not duplicated (nobody seeded on the client).
        expect(screen.getByTestId('a-text').textContent).toBe('a!seeded by server');

        expect(screen.getByTestId('a-state')).toHaveTextContent('saving');
        act(() => server.saved());
        await waitFor(() => expect(screen.getByTestId('a-state')).toHaveTextContent('saved'));
        expect(screen.getByTestId('b-state')).toHaveTextContent('live');
    });

    it('falls back (failed) when the join is refused or there is no socket', async () => {
        const server = createServer({ joinResult: { ok: false, code: 'FORBIDDEN', message: 'no' } });
        render(<Probe socket={createSocket(server)} label="c" />);
        await waitFor(() => expect(screen.getByTestId('c-state')).toHaveTextContent('off'));
        cleanup();
        render(<Probe socket={null} label="d" />);
        expect(screen.getByTestId('d-state')).toHaveTextContent('off');
        expect(screen.queryByTestId('collab-presence')).toBeNull();
    });

    it('shows other editors from awareness', async () => {
        const server = createServer();
        const s1 = createSocket(server);
        const s2 = createSocket(server);
        render(<Probe socket={s1} label="a" />);
        await waitFor(() => expect(screen.getByTestId('a-state')).toHaveTextContent('live'));
        // A second client with a user in its awareness joins through the same server.
        const { CollabProvider } = await import('../lib/collab/collab-provider');
        let other;
        act(() => { other = new CollabProvider(s2, 'knowledge', 'page1', { user: { id: 'u2', name: 'Ada' } }); });
        await waitFor(() => expect(screen.getByTestId('a-peers')).toHaveTextContent('Ada'));
        act(() => other.destroy());
        await waitFor(() => expect(screen.getByTestId('a-peers')).toHaveTextContent(''));
    });
});

describe('collabLabel', () => {
    it('maps states to the pill', () => {
        expect(collabLabel({ live: false, failed: true })).toBe('off');
        expect(collabLabel({ live: false, status: 'connecting' })).toBe('connecting');
        expect(collabLabel({ live: true, status: 'offline' })).toBe('offline');
        expect(collabLabel({ live: true, status: 'synced', readOnly: true })).toBe('readonly');
        expect(collabLabel({ live: true, status: 'synced', saveState: 'saving' })).toBe('saving');
        expect(collabLabel({ live: true, status: 'synced' })).toBe('live');
    });
});

describe('Whiteboard live', () => {
    it('shares a stroke when the pen lifts and erases it for everyone', async () => {
        const server = createServer();
        render(<TestSocketCtx.Provider value={createSocket(server)}><Whiteboard meetingId="m1" /></TestSocketCtx.Provider>);
        await waitFor(() => expect(screen.getByTestId('whiteboard-mode')).toHaveTextContent('Live'));
        expect(screen.queryByText('Save')).toBeNull();

        const canvas = screen.getByTestId('whiteboard-canvas');
        fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
        fireEvent.mouseMove(canvas, { clientX: 60, clientY: 10 });
        fireEvent.mouseUp(canvas);
        await waitFor(() => expect(server.doc.getArray('strokes').length).toBe(1));
        const stroke = server.doc.getArray('strokes').get(0);
        expect(stroke).toMatchObject({ tool: 'pen', lineWidth: 3 });
        expect(stroke.id).toBeTruthy();
        expect(stroke.points).toHaveLength(2);

        // A stroke drawn by someone else shows up too.
        act(() => server.doc.getArray('strokes').push([{ id: 'remote', tool: 'pen', color: '#FFFFFF', lineWidth: 3, points: [{ x: 500, y: 500 }, { x: 600, y: 500 }] }]));

        fireEvent.click(screen.getByRole('button', { name: /Eraser/ }));
        fireEvent.mouseDown(canvas, { clientX: 30, clientY: 11 });
        fireEvent.mouseUp(canvas);
        await waitFor(() => expect(server.doc.getArray('strokes').toArray().map((s) => s.id)).toEqual(['remote']));
    });

    it('falls back to local drawing + Save without a live connection', async () => {
        render(<Whiteboard meetingId="m2" />);
        expect(screen.getByTestId('whiteboard-mode')).toHaveTextContent('Not live');
        expect(screen.getByText('Save')).toBeInTheDocument();
    });
});
