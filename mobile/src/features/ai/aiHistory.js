// AI conversation history. Each conversation is kept on this device (works offline) and
// saved to the server, so it shows up on every device signed in to the same account.
import { api } from '../../data/session.js';
import { prefs } from '../../native/storage.js';

const LOCAL_MAX = 30;
const localKey = (ws) => `ai.threads.${ws}`;
const uploadedKey = (ws) => `ai.threads.uploaded.${ws}`;

export function loadLocal(ws) {
  const list = prefs.get(localKey(ws), []);
  return Array.isArray(list) ? list : [];
}

function writeLocal(ws, list) {
  prefs.set(localKey(ws), list.slice(0, LOCAL_MAX));
}

/** The conversation as the server stores it: { title, assistant, messages: [{ role, text, at }] }. */
export function toServer(thread) {
  return {
    title: thread.title || '',
    assistant: thread.assistant || 'default',
    messages: (thread.messages || [])
      .map((m) => ({ role: m.role, text: m.role === 'user' ? m.content : m.text, at: m.at }))
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text && m.text.trim()),
  };
}

/** A server conversation as the AI screen shows it. */
export function fromServer(chat) {
  return {
    id: chat.id,
    title: chat.title,
    assistant: chat.assistant,
    updatedAt: new Date(chat.updatedAt).getTime() || Date.now(),
    messages: (chat.messages || []).map((m, i) =>
      m.role === 'user'
        ? { id: `${chat.id}-u${i}`, role: 'user', content: m.text, at: m.at }
        : { id: `${chat.id}-a${i}`, role: 'assistant', text: m.text, at: m.at, done: true }),
  };
}

/** Save on this device, then on the server (best effort: the next save retries). */
export async function saveConversation(ws, thread) {
  if (!ws || !thread?.messages?.some((m) => m.role === 'user')) return;
  const entry = { ...thread, updatedAt: Date.now() };
  writeLocal(ws, [entry, ...loadLocal(ws).filter((t) => t.id !== thread.id)]);
  try {
    await api().saveAiChat?.(ws, thread.id, toServer(thread));
  } catch { /* offline or an older server: kept on this device */ }
}

/**
 * Past conversations for the history list: the server's (newest first) plus any that only
 * exist on this device. Each item: { id, title, updatedAt, local?, preview? }.
 */
export async function listConversations(ws) {
  const local = loadLocal(ws);
  let remote = null;
  try {
    remote = (await api().aiChats?.(ws)) || null;
  } catch { /* offline: the device's copy */ }
  if (!remote) return local.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, local: true }));

  // Once per workspace, copy conversations saved before history synced.
  if (!prefs.get(uploadedKey(ws))) {
    const known = new Set(remote.map((c) => c.id));
    const missing = local.filter((t) => !known.has(t.id));
    for (const t of missing) {
      try { await api().saveAiChat(ws, t.id, toServer(t)); } catch { /* try again next time */ return mergeLists(remote, local); }
    }
    prefs.set(uploadedKey(ws), true);
    if (missing.length) {
      try { remote = (await api().aiChats(ws)) || remote; } catch { /* keep the first list */ }
    }
  }
  return mergeLists(remote, local);
}

function mergeLists(remote, local) {
  const byId = new Map(remote.map((c) => [c.id, { id: c.id, title: c.title, updatedAt: new Date(c.updatedAt).getTime(), preview: c.preview }]));
  for (const t of local) if (!byId.has(t.id)) byId.set(t.id, { id: t.id, title: t.title, updatedAt: t.updatedAt, local: true });
  return [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** The full conversation: this device's copy, else the server's. */
export async function openConversation(ws, id) {
  const local = loadLocal(ws).find((t) => t.id === id);
  try {
    const chat = await api().aiChat?.(ws, id);
    if (chat) return fromServer(chat);
  } catch { /* offline */ }
  return local || null;
}

export async function renameConversation(ws, id, title) {
  const clean = String(title || '').trim();
  if (!clean) return;
  writeLocal(ws, loadLocal(ws).map((t) => (t.id === id ? { ...t, title: clean } : t)));
  try { await api().renameAiChat?.(ws, id, clean); } catch { /* kept on this device */ }
}

export async function deleteConversation(ws, id) {
  writeLocal(ws, loadLocal(ws).filter((t) => t.id !== id));
  await api().deleteAiChat?.(ws, id);
}

/** Every conversation in this workspace, here and on the server. */
export async function clearConversations(ws) {
  writeLocal(ws, []);
  await api().clearAiChats?.(ws);
}
