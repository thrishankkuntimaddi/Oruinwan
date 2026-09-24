/**
 * Persistent offline action queue (module singleton).
 *  - One in-memory array, persisted after every mutation.
 *  - flush() is mutex-guarded: concurrent callers share the same run.
 *  - Each item is removed only after its handler resolves; items enqueued
 *    during a flush are simply appended and processed in the same run.
 *  - Handlers must return a promise that resolves on server acknowledgement.
 *  - Message payloads are stored already encrypted (never plaintext).
 */
import { cacheGet, cacheSet, cacheRemove } from './storage';
import { isOnline, onConnectivityChange } from './connectivity';
import { emit } from './events';

const QUEUE_KEY = 'offline_queue_v2';
const MAX_ATTEMPTS = 5;

let queue = [];
let loadPromise = null;
let flushPromise = null;
const handlers = new Map();
const listeners = new Set();

function notify() {
  const n = queue.length;
  listeners.forEach((fn) => fn(n));
}

function load() {
  if (!loadPromise) {
    loadPromise = cacheGet(QUEUE_KEY).then((saved) => {
      const restored = Array.isArray(saved) ? saved : [];
      queue = [...restored, ...queue];
      notify();
    });
  }
  return loadPromise;
}

const persist = () => cacheSet(QUEUE_KEY, queue);

let seq = 0;
const newId = () => `q_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function registerQueueHandler(type, handler) {
  handlers.set(type, handler);
}

export function getQueueLength() { return queue.length; }
export function onQueueChange(fn) {
  listeners.add(fn);
  load().catch(() => {});
  fn(queue.length);
  return () => listeners.delete(fn);
}

export async function enqueue(action) {
  await load();
  const item = { ...action, id: action.id || newId(), attempts: 0, createdAt: Date.now() };
  queue.push(item);
  await persist();
  notify();
  if (isOnline()) flush();
  return item;
}

function isPermanent(err) {
  const s = err?.response?.status;
  return !!s && s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429;
}

export function flush() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    await load();
    while (queue.length && isOnline()) {
      const item = queue[0];
      const handler = handlers.get(item.type);
      if (!handler) {
        // Handler not registered yet (screen not mounted) — leave for later.
        break;
      }
      try {
        const result = await handler(item.payload, item);
        queue.shift();
        await persist();
        notify();
        emit('queue:processed', { item, result });
      } catch (err) {
        item.attempts += 1;
        if (isPermanent(err) || item.attempts >= MAX_ATTEMPTS) {
          queue.shift();
          await persist();
          notify();
          emit('queue:failed', { item, error: err });
          continue;
        }
        await persist();
        break; // transient — retry on next connectivity change
      }
    }
  })()
    .catch((e) => console.warn('[OfflineQueue] flush error:', e?.message))
    .finally(() => { flushPromise = null; });
  return flushPromise;
}

export async function clearQueue() {
  queue = [];
  await cacheRemove(QUEUE_KEY);
  notify();
}

onConnectivityChange((online) => { if (online) flush(); });
