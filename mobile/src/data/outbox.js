// The offline message queue. A message sent without a connection (or whose send fails for lack
// of one) is encrypted right away and kept here with a clientMessageId, shown as "Queued" in its
// conversation, and sent in order once the connection is back (network up, socket reconnects,
// app resumes). The server deduplicates on clientMessageId, so a retry after a lost response
// never posts twice.
//
// Only ciphertext is saved on the device (prefs 'outbox.<userId>'). When this device has no key
// for a conversation yet, the message waits in memory and is encrypted as it is sent.
import { useMemo } from 'react';
import { create } from 'zustand';
import { api, useSession } from './session.js';
import { invalidate } from './query.js';
import { on } from '../lib/bus.js';
import { uid } from '../lib/id.js';
import { prefs } from '../native/storage.js';
import { onAppState, onNetworkChange } from '../native/index.js';

export const useOutbox = create(() => ({ items: [], online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, flushing: false }));

let owner = null; // user id whose queue this is
const plain = new Map(); // id → text, never persisted
const mentions = new Map(); // id → mentionText (handles only), never persisted

const storeKey = () => (owner ? `outbox.${owner}` : null);

/** What is saved: everything but the plain text, and only items that are encrypted. */
export function persistable(items) {
  return items.filter((i) => i.prepared).map(({ id, key, conv, parentId, prepared, at, status, error }) => ({ id, key, conv, parentId, prepared, at, status: status === 'sending' ? 'queued' : status, error: error || null }));
}

function save() {
  const k = storeKey();
  if (k) prefs.set(k, persistable(useOutbox.getState().items));
}

function setItems(fn) {
  useOutbox.setState((s) => ({ items: fn(s.items) }));
  save();
}

/** True when a send should go to the queue instead of the network. */
export const isOffline = () => !useOutbox.getState().online;

/** A send failed: was it the connection (queue it) or the server (show it as failed)? */
export const isNetworkError = (err) => Boolean(err?.network || err?.status === 0);

/**
 * Queues a message. conv: { kind, id }; key: its query key (messages:<id> or thread:<id>).
 * Resolves with the queued item's id (its clientMessageId).
 */
export async function enqueue({ conv, key, parentId = null, text, clientMessageId, mentionText = '' }) {
  const id = clientMessageId || uid('cm');
  plain.set(id, text);
  if (mentionText) mentions.set(id, mentionText);
  let prepared = null;
  try {
    prepared = await api().prepareMessage?.(conv, text, { parentId, clientMessageId: id, mentionText, workspaceId: useSession.getState().workspaceId });
  } catch {
    prepared = null; // no key on this device yet: encrypted when it is sent
  }
  setItems((items) => [...items.filter((i) => i.id !== id), { id, key, conv: { kind: conv.kind, id: conv.id }, parentId, prepared, at: new Date().toISOString(), status: 'queued', error: null }]);
  if (!isOffline()) flush();
  return id;
}

/** Sends one item: the prepared ciphertext, or encrypts now when there was no key. */
export async function sendItem(item, a = api()) {
  let prepared = item.prepared;
  if (!prepared) {
    const text = plain.get(item.id);
    if (text == null) throw Object.assign(new Error('This message could not be recovered.'), { permanent: true });
    prepared = await a.prepareMessage(item.conv, text, { parentId: item.parentId, clientMessageId: item.id, mentionText: mentions.get(item.id), workspaceId: useSession.getState().workspaceId });
  }
  try {
    return await a.sendPrepared(prepared);
  } catch (err) {
    // The conversation got a new key while this waited (someone was added or removed): encrypt it
    // again with the new key and send once more. The text comes from memory or, after a restart,
    // from the queued ciphertext (this device still holds the earlier key).
    if (err?.code !== 'KEY_ROTATED') throw err;
    const text = plain.get(item.id) ?? (await a.readPrepared?.(item.conv, prepared).catch(() => null));
    if (text == null) throw err;
    const again = await a.prepareMessage(item.conv, text, { parentId: item.parentId, clientMessageId: item.id, mentionText: mentions.get(item.id), workspaceId: useSession.getState().workspaceId });
    return a.sendPrepared(again);
  }
}

/**
 * Sends queued messages oldest first. Stops at the first connection failure (the rest wait for
 * the next reconnect); a message the server refuses is marked failed and the others continue.
 */
export async function flush({ send = sendItem } = {}) {
  const state = useOutbox.getState();
  if (state.flushing || !state.items.some((i) => i.status === 'queued')) return;
  useOutbox.setState({ flushing: true });
  try {
    for (const item of [...useOutbox.getState().items]) {
      if (item.status !== 'queued') continue;
      setItems((items) => items.map((i) => (i.id === item.id ? { ...i, status: 'sending' } : i)));
      try {
        await send(item);
        plain.delete(item.id);
        mentions.delete(item.id);
        setItems((items) => items.filter((i) => i.id !== item.id));
        invalidate(item.key, `messages:${item.conv.id}`, 'channels', 'dms');
      } catch (err) {
        if (isNetworkError(err)) {
          setItems((items) => items.map((i) => (i.id === item.id ? { ...i, status: 'queued' } : i)));
          useOutbox.setState({ online: false });
          break;
        }
        setItems((items) => items.map((i) => (i.id === item.id ? { ...i, status: 'failed', error: err?.message || 'Not sent' } : i)));
      }
    }
  } finally {
    useOutbox.setState({ flushing: false });
  }
}

/** Tries a failed queued message again. */
export function retryQueued(id) {
  setItems((items) => items.map((i) => (i.id === id ? { ...i, status: 'queued', error: null } : i)));
  if (!isOffline()) flush();
}

export function discardQueued(id) {
  plain.delete(id);
  mentions.delete(id);
  setItems((items) => items.filter((i) => i.id !== id));
}

/** Queued messages of one conversation (or thread), shaped like messages, oldest first. */
export function useQueuedMessages(key) {
  const items = useOutbox((s) => s.items);
  const me = useSession((s) => s.user?.id);
  return useMemo(
    () =>
      items
        .filter((i) => i.key === key)
        .map((i) => {
          const text = plain.get(i.id);
          return {
            id: i.id,
            convId: i.conv.id,
            authorId: me,
            text: text ?? 'Encrypted message waiting to send',
            state: 'ok',
            at: i.at,
            reactions: {},
            parentId: i.parentId,
            queued: true,
            pending: i.status !== 'failed',
            failed: i.status === 'failed',
            error: i.error,
          };
        }),
    [items, key, me],
  );
}

/** After a restart the queue holds ciphertext only: read the text back once keys are there. */
async function restoreTexts() {
  for (const i of useOutbox.getState().items) {
    if (plain.has(i.id) || !i.prepared) continue;
    try {
      plain.set(i.id, await api().readPrepared(i.conv, i.prepared));
    } catch {
      /* still locked: shown as "Encrypted message waiting to send" */
    }
  }
  useOutbox.setState((s) => ({ items: [...s.items] }));
}

let offs = [];

/** Loads this account's queue and sends it whenever the connection comes back. */
export function startOutbox(userId) {
  stopOutbox();
  owner = userId || null;
  const saved = (owner && prefs.get(`outbox.${owner}`, [])) || [];
  useOutbox.setState({ items: Array.isArray(saved) ? saved.map((i) => ({ ...i, status: i.status === 'failed' ? 'failed' : 'queued' })) : [] });
  const online = (up) => {
    useOutbox.setState({ online: up });
    if (up) {
      restoreTexts();
      flush();
    }
  };
  offs.push(on('realtime', ({ connected }) => connected && online(true)));
  offs.push(on('e2ee:ready', () => restoreTexts()));
  onNetworkChange(online).then((off) => offs.push(off)).catch(() => {});
  onAppState((active) => active && !isOffline() && flush()).then((off) => offs.push(off)).catch(() => {});
  // A slow trickle while messages wait, in case no event says the connection is back.
  const t = setInterval(() => {
    if (useOutbox.getState().items.some((i) => i.status === 'queued')) flush();
  }, 30_000);
  offs.push(() => clearInterval(t));
  restoreTexts();
}

export function stopOutbox() {
  offs.forEach((off) => {
    try {
      off();
    } catch {
      /* already removed */
    }
  });
  offs = [];
}

/** Signing out: drop the queue (it belongs to that account). */
export function clearOutbox() {
  if (owner) prefs.set(`outbox.${owner}`, null);
  plain.clear();
  owner = null;
  useOutbox.setState({ items: [] });
}
