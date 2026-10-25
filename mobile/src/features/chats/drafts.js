// Unsent text per conversation, kept on this device (not encrypted text on a server): typing
// in a conversation saves it; sending clears it. Drafts & scheduled lists them.
import { create } from 'zustand';
import { prefs } from '../../native/storage.js';

const KEY = 'chat.drafts.v1';
const MAX_DRAFTS = 60;

const load = () => {
  const v = prefs.get(KEY, {});
  return v && typeof v === 'object' ? v : {};
};

/** { "<ws>|<kind>|<id>": { ws, kind, id, text, at } } */
export const useDrafts = create(() => ({ all: load() }));

const keyOf = (ws, conv) => `${ws}|${conv.kind}|${conv.id}`;

export function draftFor(ws, conv) {
  if (!ws || !conv?.id) return '';
  return useDrafts.getState().all[keyOf(ws, conv)]?.text || '';
}

export function saveDraft(ws, conv, text) {
  if (!ws || !conv?.id) return;
  const k = keyOf(ws, conv);
  const all = { ...useDrafts.getState().all };
  const value = String(text || '');
  if (!value.trim()) {
    if (!all[k]) return;
    delete all[k];
  } else {
    if (all[k]?.text === value) return;
    all[k] = { ws, kind: conv.kind, id: conv.id, text: value, at: new Date().toISOString() };
    // Keep the newest ones only.
    const keys = Object.keys(all).sort((a, b) => String(all[b].at).localeCompare(String(all[a].at)));
    for (const old of keys.slice(MAX_DRAFTS)) delete all[old];
  }
  prefs.set(KEY, all);
  useDrafts.setState({ all });
}

export const clearDraft = (ws, conv) => saveDraft(ws, conv, '');

/** Drafts in a workspace, newest first. */
export function draftsIn(all, ws) {
  return Object.values(all || {})
    .filter((d) => d.ws === ws && d.text?.trim())
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
