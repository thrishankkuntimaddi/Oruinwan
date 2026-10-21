// Tells the server which conversation (or thread) is on screen, the same `presence:viewing` the
// web app sends. The server then stores no notification and sends no push for messages the
// person is already reading. Screens register with useViewing(); the newest one on the stack wins
// (a thread opened over its conversation), and nothing counts while the app is in the background.
import { useEffect } from 'react';
import { socketEmit } from './realtime.js';
import { onAppState } from '../../native/index.js';
import { on } from '../../lib/bus.js';

const HEARTBEAT_MS = 60_000;
const stack = []; // [{ token, kind, id, threadId }]
let foreground = true;
let timer = null;
let appStateWired = false;

/** What the server should be told right now. */
export function currentViewing() {
  const top = stack[stack.length - 1] || null;
  // A thread screen covers its conversation: only the thread is on screen.
  const conv = top && !top.threadId ? top : null;
  return {
    conversationType: conv?.kind || null,
    conversationId: conv?.id || null,
    threadId: top?.threadId || null,
    client: 'mobile',
    visible: foreground,
    focused: foreground,
  };
}

export function reportViewing() {
  socketEmit('presence:viewing', currentViewing());
}

function ensureHeartbeat() {
  if (timer || typeof setInterval !== 'function') return;
  timer = setInterval(() => { if (foreground) reportViewing(); }, HEARTBEAT_MS);
}

function wireAppState() {
  if (appStateWired) return;
  appStateWired = true;
  // A reconnected socket starts with a clean slate on the server.
  on('realtime', (s) => { if (s?.connected) reportViewing(); });
  Promise.resolve(onAppState((active) => {
    foreground = !!active;
    reportViewing();
  })).catch(() => { /* no app state events: stays foreground */ });
}

/** Register a screen showing a conversation (kind 'channel' | 'dm') or one of its threads. */
export function pushViewing({ kind, id, threadId = null }) {
  const token = {};
  if (kind && id) stack.push({ token, kind, id: String(id), threadId: threadId ? String(threadId) : null });
  wireAppState();
  ensureHeartbeat();
  reportViewing();
  return () => {
    const i = stack.findIndex((e) => e.token === token);
    if (i >= 0) stack.splice(i, 1);
    reportViewing();
  };
}

/** Hook form of pushViewing for screens. */
export function useViewing(kind, id, threadId = null) {
  useEffect(() => pushViewing({ kind, id, threadId }), [kind, id, threadId]);
}

export function _resetViewing() {
  stack.length = 0;
  foreground = true;
}
