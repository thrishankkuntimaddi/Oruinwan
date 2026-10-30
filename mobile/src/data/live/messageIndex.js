// Message search on the phone. Message text is end-to-end encrypted, so the server can't search
// it. Messages are indexed here as they're decrypted (opened conversations, live updates) and,
// when a search starts, the latest messages of conversations not opened yet are fetched too.
// Memory only: nothing decrypted is written to the device, and signing out clears it.

const conversations = new Map(); // convId -> { kind, name, ws, messages: Map<id, {id, text, authorId, at}> }
const MAX_PER_CONVERSATION = 1500;
// A conversation fetched for search is fetched again after this, to pick up newer messages.
const FRESH_MS = 2 * 60 * 1000;

export function nameConversation(convId, { kind, name, ws }) {
  if (!convId) return;
  const conv = conversations.get(convId) || { kind, name, ws, messages: new Map(), loadedAt: 0 };
  conv.kind = kind || conv.kind;
  conv.name = name || conv.name;
  conv.ws = ws || conv.ws;
  conversations.set(convId, conv);
}

function checklistWords(json) {
  try {
    const d = JSON.parse(json);
    return [d.title, ...(d.items || []).map((i) => (typeof i === 'object' ? i?.text : i))].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

/** Adds decrypted messages (the app's message shape) to the index. */
export function indexMessages(conv, list, { complete = false } = {}) {
  if (!conv?.id) return;
  const entry = conversations.get(conv.id) || { kind: conv.kind, name: null, ws: null, messages: new Map(), loadedAt: 0 };
  for (const m of list || []) {
    const files = (m?.attachments || []).map((a) => ({ type: a.type, mimeType: a.mimeType }));
    // A checklist's text is its JSON (title and items); search its words, not the syntax.
    const text = m?.state === 'ok' ? (m.type === 'checklist' ? checklistWords(m.text) : m.text || '') : '';
    if (!m?.id || !(text || files.length)) continue;
    entry.messages.set(m.id, {
      id: m.id,
      text,
      authorId: m.authorId,
      at: m.at,
      parentId: m.parentId || null,
      pinned: Boolean(m.pinned),
      replyCount: m.replyCount || 0,
      attachments: files,
    });
  }
  if (entry.messages.size > MAX_PER_CONVERSATION) {
    const extra = entry.messages.size - MAX_PER_CONVERSATION;
    [...entry.messages.keys()].slice(0, extra).forEach((k) => entry.messages.delete(k));
  }
  if (complete) entry.loadedAt = Date.now();
  conversations.set(conv.id, entry);
}

/** The newest decrypted text in a conversation (from `authorId` when given), or ''. */
export function latestText(convId, authorId = null) {
  const entry = conversations.get(String(convId));
  if (!entry) return '';
  let best = null;
  for (const m of entry.messages.values()) {
    if (!m.text || (authorId && m.authorId !== authorId)) continue;
    if (!best || new Date(m.at) > new Date(best.at)) best = m;
  }
  return best?.text || '';
}

export function forgetMessage(convId, messageId) {
  conversations.get(convId)?.messages.delete(messageId);
}

/** Conversations whose latest messages haven't been fetched lately. */
export function unloaded(ws, convs, now = Date.now()) {
  return convs.filter((c) => now - (conversations.get(c.id)?.loadedAt || 0) > FRESH_MS && (!c.ws || c.ws === ws));
}

/**
 * Newest first, in the search screen's shape. `query` is text (every word must appear) or a
 * matcher (message, { kind, name }) => boolean, e.g. from lib/searchQuery.js.
 */
export function searchIndex(ws, query, limit = 50) {
  let match = query;
  if (typeof query !== 'function') {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    match = (m) => {
      const text = m.text.toLowerCase();
      return words.every((w) => text.includes(w));
    };
  }
  const out = [];
  for (const [convId, conv] of conversations) {
    if (ws && conv.ws && conv.ws !== ws) continue;
    for (const m of conv.messages.values()) {
      if (!match(m, { kind: conv.kind, name: conv.name })) continue;
      out.push({ ...m, convId, convKind: conv.kind, convName: conv.name || (conv.kind === 'channel' ? 'a channel' : 'a direct message') });
    }
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

export function clearMessageIndex() {
  conversations.clear();
}
