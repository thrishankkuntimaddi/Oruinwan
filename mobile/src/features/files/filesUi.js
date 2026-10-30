import { create } from 'zustand';
import { prefs } from '../../native/storage.js';
/** Tags as the server stores them: trimmed, lower case, no blanks or duplicates. */
export function normalizeTags(list) {
  const out = [];
  for (const raw of list || []) {
    const t = String(raw ?? '').trim().toLowerCase().replace(/^#/, '');
    if (t && !out.includes(t)) out.push(t.slice(0, 40));
  }
  return out;
}

// ---------------------------------------------------------------- Shared with me
// GET /api/v2/files/shared: attachments from the person's channels, DMs and group DMs plus
// library uploads. Chat files keep their stored url and open through the same signed links
// and viewers as in the conversation.

export const KIND_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'media', label: 'Media' },
  { value: 'other', label: 'Other' },
];

export const SOURCE_OPTIONS = [
  { value: 'all', label: 'Everywhere' },
  { value: 'library', label: 'Uploaded to Files' },
  { value: 'channels', label: 'Channels' },
  { value: 'dms', label: 'Direct messages' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'size', label: 'Largest first' },
];

/** Query for the endpoint; `source` may be 'conv:<id>' for one channel or DM. */
export function sharedQuery(ws, { kind = 'all', source = 'all', q = '', sort = 'newest', limit = 50, offset = 0 } = {}) {
  const query = { workspaceId: ws, sort, limit, offset };
  if (kind && kind !== 'all') query.kind = kind;
  if (source?.startsWith('conv:')) query.conversationId = source.slice(5);
  else if (source && source !== 'all') query.source = source;
  const term = String(q || '').trim();
  if (term) query.q = term;
  return query;
}

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

/** The app's model of one item; it is also what openFile() and the viewers take. */
export function mapSharedFile(it) {
  const by = it?.sharedBy && typeof it.sharedBy === 'object' ? it.sharedBy : null;
  const conv = it?.conversation
    ? { id: String(it.conversation.id), kind: it.conversation.type === 'channel' ? 'channel' : 'dm', name: it.conversation.name || '', isGroup: !!it.conversation.isGroup }
    : null;
  return {
    id: String(it?.id || ''),
    source: it?.source || 'library',
    fileId: it?.fileId || null,
    name: it?.name || 'File',
    size: Number.isFinite(it?.size) ? it.size : null,
    mimeType: it?.mimeType || '',
    type: it?.type || 'file',
    url: it?.url || null,
    width: it?.width || null,
    height: it?.height || null,
    duration: Number.isFinite(it?.duration) ? it.duration : null,
    kind: it?.kind || 'other',
    byId: by ? idOf(by) : idOf(it?.sharedBy),
    byName: by?.username || null,
    at: it?.sharedAt || null,
    messageId: it?.messageId || null,
    parentId: it?.parentId || null,
    conv,
    tags: it?.tags || [],
  };
}

/** "#general", a person's or group's name, or "Files" for uploads. */
export function whereLabel(item) {
  if (!item?.conv) return 'Files';
  return item.conv.kind === 'channel' ? `#${item.conv.name || 'channel'}` : item.conv.name || 'Direct message';
}

/** Where "Go to message" leads: { route, params } for nav.push, or null for uploads. */
export function messageTarget(item) {
  if (!item?.messageId || !item.conv) return null;
  if (item.parentId) return { route: 'thread', params: { kind: item.conv.kind, convId: item.conv.id, messageId: item.parentId } };
  return { route: 'conversation', params: { kind: item.conv.kind, id: item.conv.id, highlight: item.messageId } };
}

// ---------------------------------------------------------------- Starred and archived
// Kept on this phone per workspace: star files you come back to, archive ones you're done with
// (they leave the main list but stay in Archived; nothing is deleted).

const marksKey = (ws) => `files.marks:${ws}`;
const readMarks = (ws) => {
  try {
    const v = prefs.get(marksKey(ws));
    return { starred: Array.isArray(v?.starred) ? v.starred : [], archived: Array.isArray(v?.archived) ? v.archived : [] };
  } catch {
    return { starred: [], archived: [] };
  }
};
export const useFileMarks = create(() => ({ byWs: {} }));
export function fileMarks(ws) {
  const s = useFileMarks.getState().byWs[ws];
  if (s) return s;
  const m = readMarks(ws);
  useFileMarks.setState((st) => ({ byWs: { ...st.byWs, [ws]: m } }));
  return m;
}
/** Flip a mark ('starred' | 'archived') on a file; returns whether it's now on. */
export function toggleFileMark(ws, kind, id) {
  const m = fileMarks(ws);
  const on = !m[kind].includes(id);
  const next = { ...m, [kind]: on ? [id, ...m[kind]].slice(0, 500) : m[kind].filter((x) => x !== id) };
  useFileMarks.setState((st) => ({ byWs: { ...st.byWs, [ws]: next } }));
  try {
    prefs.set(marksKey(ws), next);
  } catch {
    /* storage not ready */
  }
  return on;
}
