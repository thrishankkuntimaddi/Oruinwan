// Files being sent from a composer. Each file is uploaded with progress, then sent as its own
// message (as on the web). They live here, not in the message cache, so a realtime refresh of
// the conversation can't wipe a bubble that is still uploading or that failed and waits for Retry.
// Uploads keep going when you leave the conversation; Cancel stops one.
import { useSyncExternalStore } from 'react';
import { api } from '../../data/session.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { uid } from '../../lib/id.js';
import { toast } from '../../lib/bus.js';
import { previewKind, readImageSize, validateUpload } from '../../lib/files.js';

const lists = new Map(); // conversation cache key → [item]
const jobs = new Map(); // item id → { file, conv, key, threadOf, controller }
const subs = new Map(); // key → Set(listener)
// Files upload in parallel but are sent in the order they were added (as on the web).
const turns = new Map(); // key → promise settled when the last queued send is done
const EMPTY = [];

function set(key, fn) {
  lists.set(key, fn(lists.get(key) || EMPTY));
  subs.get(key)?.forEach((l) => l());
}
const patchItem = (key, id, p) => set(key, (list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));
function removeItem(key, id) {
  const item = (lists.get(key) || EMPTY).find((m) => m.id === id);
  for (const a of item?.attachments || []) if (a.localUrl) setTimeout(() => URL.revokeObjectURL(a.localUrl), 30_000);
  set(key, (list) => list.filter((m) => m.id !== id));
  jobs.delete(id);
}

/** The uploads of a conversation right now (outside React). */
export const uploadsFor = (key) => lists.get(key) || EMPTY;

/** The uploads (pending or failed) shown at the end of a conversation or thread. */
export function useUploads(key) {
  return useSyncExternalStore(
    (cb) => {
      if (!key) return () => {};
      if (!subs.has(key)) subs.set(key, new Set());
      subs.get(key).add(cb);
      return () => subs.get(key)?.delete(cb);
    },
    () => (key && lists.get(key)) || EMPTY,
  );
}

async function run(id) {
  const job = jobs.get(id);
  if (!job) return;
  const { file, conv, key, threadOf, size: sizeOf } = job;
  const controller = new AbortController();
  job.controller = controller;
  patchItem(key, id, { pending: true, failed: false, error: null, upload: { progress: 0 } });
  let last = 0;
  const previous = turns.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => {
    release = r;
  });
  turns.set(key, previous.then(() => mine));
  try {
    const [size, uploaded] = await Promise.all([
      sizeOf,
      api().uploadAttachment(conv, file, {
        signal: controller.signal,
        onProgress: (progress) => {
          // A re-render per percent is wasted work; every few percent reads the same.
          if (progress - last < 4 && progress < 100) return;
          last = progress;
          patchItem(key, id, { upload: { progress } });
        },
      }),
    ]);
    if (controller.signal.aborted) return;
    patchItem(key, id, { upload: { progress: 100, sending: true } });
    await previous;
    if (controller.signal.aborted) return;
    const saved = await api().sendAttachment(conv, { ...uploaded, ...(size || {}) }, { parentId: threadOf || null, clientTempId: id });
    if (controller.signal.aborted) return;
    setQueryData(key, (d) => (d && !d.items.some((m) => m.id === saved.id) ? { ...d, items: [...d.items, saved] } : d));
    removeItem(key, id);
    if (threadOf) invalidate(`messages:${conv.id}`);
  } catch (err) {
    if (controller.signal.aborted || err?.name === 'AbortError') return;
    patchItem(key, id, { pending: false, failed: true, error: err?.message || 'The upload failed.', upload: { progress: 0, failed: true } });
    if (err?.noRetry) toast(err.message, 'danger');
  } finally {
    release();
  }
}

/**
 * Adds files to a conversation (or thread, with `threadOf`). Files that can't be sent (empty,
 * over 100 MB, programs) are refused with a message. Returns how many were queued.
 */
export function sendFiles({ key, conv, threadOf, me, files }) {
  let queued = 0;
  for (const file of Array.from(files || [])) {
    const problem = validateUpload(file);
    if (problem) {
      toast(problem, 'danger');
      continue;
    }
    const id = uid('up');
    const kind = previewKind({ mimeType: file.type, name: file.name });
    const item = {
      id,
      convId: conv.id,
      authorId: me,
      text: '',
      state: 'attachment',
      at: new Date().toISOString(),
      reactions: {},
      parentId: threadOf || null,
      pending: true,
      attachments: [
        {
          type: kind === 'audio' ? 'voice' : kind === 'image' || kind === 'video' ? kind : 'file',
          name: file.name || 'file',
          size: file.size,
          mimeType: file.type || '',
          // Photos and videos show from the phone while they upload.
          localUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
        },
      ],
      upload: { progress: 0 },
    };
    // A photo's real shape, so its bubble doesn't change size when the sent message replaces it.
    const size = readImageSize(file);
    jobs.set(id, { file, conv, key, threadOf, size });
    set(key, (list) => [...list, item]);
    size.then((dims) => {
      if (!dims) return;
      set(key, (list) => list.map((m) => (m.id === id ? { ...m, attachments: m.attachments.map((a) => ({ ...a, ...dims })) } : m)));
    });
    run(id);
    queued += 1;
  }
  return queued;
}

export function retryUpload(id) {
  run(id);
}

export function cancelUpload(id) {
  const job = jobs.get(id);
  if (!job) return;
  job.controller?.abort();
  removeItem(job.key, id);
}
