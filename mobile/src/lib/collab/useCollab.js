// React side of live editing: one provider per open document, its state machine and the
// people in it. Providers are shared by key, and one that holds edits made offline is kept
// (not destroyed) after its editor closes until those edits have reached the server.
import { useEffect, useReducer, useState } from 'react';
import { CollabProvider } from './provider.js';
import { collabReducer, initialCollabState, peersFrom } from './state.js';
import { toneFor } from '../../ui/Avatar.jsx';
import { api, useSession } from '../../data/session.js';
import { realtimeSocket } from '../../data/live/realtime.js';

const JOIN_TIMEOUT_MS = 8000;
const entries = new Map(); // key → { provider, refs, dirty, release }

function acquire(socket, docType, docId, user) {
  const key = `${docType}:${docId}`;
  let entry = entries.get(key);
  if (entry && entry.provider.socket !== socket) {
    entry.provider.destroy();
    entries.delete(key);
    entry = null;
  }
  if (!entry) {
    const provider = new CollabProvider(socket, docType, docId, { user, joinTimeoutMs: JOIN_TIMEOUT_MS });
    entry = { provider, refs: 0, dirty: false };
    // Edits typed while disconnected stay in the Y.Doc; the next sync sends them.
    provider.doc.on('update', (_u, origin) => {
      if (origin !== 'collab-provider' && !provider.joined) entry.dirty = true;
    });
    provider.on('synced', () => {
      entry.dirty = false;
      if (entry.refs === 0) setTimeout(() => drop(key, entry), 1500);
    });
    provider.on('closed', () => {
      entry.dirty = false;
      if (entry.refs === 0) drop(key, entry);
    });
    entries.set(key, entry);
  }
  entry.refs += 1;
  return entry;
}

function drop(key, entry) {
  if (entry.refs > 0 || entries.get(key) !== entry) return;
  entries.delete(key);
  entry.provider.destroy();
}

function release(key, entry) {
  entry.refs -= 1;
  if (entry.refs > 0) return;
  // Unsent offline edits: keep the document joined-on-reconnect until they're through.
  if (entry.dirty && !entry.provider.synced && entry.provider.status !== 'closed') return;
  drop(key, entry);
}

/** Leave every document (sign-out, server switch). */
export function closeAllCollab() {
  for (const [key, entry] of entries) {
    entries.delete(key);
    entry.provider.destroy();
  }
}

/**
 * @param socket  the app's Socket.IO socket (null: live editing unavailable → mode 'rest')
 * @param user    { id, name, avatarUrl } for presence
 */
export function useCollab(socket, docType, docId, user) {
  const [state, dispatch] = useReducer(collabReducer, socket ? initialCollabState(socket.connected) : { ...initialCollabState(true), mode: 'rest' });
  const [provider, setProvider] = useState(null);
  const [peers, setPeers] = useState([]);
  const userKey = user ? `${user.id}|${user.name}|${user.avatarUrl || ''}` : '';

  useEffect(() => {
    if (!socket || !docId) return undefined;
    const key = `${docType}:${docId}`;
    const name = user?.name || 'Someone';
    const entry = acquire(socket, docType, docId, { id: user?.id, name, color: toneFor(name), avatar: user?.avatarUrl || null });
    const p = entry.provider;
    dispatch({ type: 'reset', connected: socket.connected });
    if (p.synced) dispatch({ type: 'synced', readOnly: p.readOnly });
    else if (p.status === 'offline' || !socket.connected) dispatch({ type: 'status', status: 'offline' });
    const offs = [
      p.on('status', (status) => dispatch({ type: 'status', status })),
      p.on('synced', ({ readOnly }) => dispatch({ type: 'synced', readOnly })),
      p.on('saved', ({ savedAt }) => dispatch({ type: 'saved', savedAt })),
      p.on('error', (e) => dispatch({ type: 'error', code: e?.code, message: e?.message })),
      p.on('closed', ({ reason }) => dispatch({ type: 'closed', reason })),
    ];
    const updatePeers = () => setPeers(peersFrom(p.awareness.getStates(), p.doc.clientID, user?.id));
    p.awareness.on('change', updatePeers);
    updatePeers();
    setProvider(p);
    return () => {
      offs.forEach((off) => off());
      p.awareness.off('change', updatePeers);
      setProvider(null);
      release(key, entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user is identified by userKey
  }, [socket, docType, docId, userKey]);

  return { state, provider, doc: provider?.doc || null, peers };
}

/** useCollab for a screen: the app's socket when signed in to a live server, and the signed-in user. */
export function useLiveDocument(docType, docId) {
  const user = useSession((s) => s.user);
  const socket = api()?.kind === 'live' ? realtimeSocket() : null;
  return useCollab(socket, docType, docId, user);
}
