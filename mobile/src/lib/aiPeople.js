// People @mentioned in AI chats (the AI tab and chats with agents), and what the
// assistant did for them. A picked person goes to the server as { id, name } (plus our
// DM with them, decrypted on the phone, for "what did we say about…") so the assistant
// knows exactly who is meant; the text keeps "@username".

import { findMentions, mentionedPeople } from '../../../platform/people/mentions.js';

const ASSISTANT_HANDLES = /^(ai|oruinwan(?:[-_]?ai)?|claude|chatgpt|gpt|gemini|grok|local)$/i;
const lower = (s) => String(s || '').toLowerCase();

/**
 * People named in `text` by "@username": the ones picked from suggestions first, then any
 * typed handle of a workspace member. Assistants and the signed-in user are skipped.
 * Returns [{ id, name, username }].
 */
export function peopleInText(text, { picked = [], people = [], me = null } = {}) {
  const list = [...picked, ...people].filter((p) => p?.username && !ASSISTANT_HANDLES.test(p.username));
  const out = [];
  const seen = new Set();
  for (const p of mentionedPeople(text, list)) {
    if (!p?.id || p.id === me || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name || p.username, username: p.username });
  }
  return out;
}

/**
 * Mentions for the request: up to 5 people as { id, name }, each with `transcript` (our DM
 * with them, decrypted on the phone) when `transcriptOf(person)` gives one. Never throws.
 */
export async function withTranscripts(people, transcriptOf = null) {
  return Promise.all((people || []).slice(0, 5).map(async (p) => {
    let transcript = [];
    if (transcriptOf) {
      try {
        transcript = (await transcriptOf(p)) || [];
      } catch {
        transcript = [];
      }
    }
    return { id: p.id, name: p.name, ...(transcript.length ? { transcript } : {}) };
  }));
}

/** Splits text into strings and { person } parts for each "@username" of a mentioned person. */
export function mentionParts(text, people = []) {
  const list = people.filter((p) => p?.username);
  const src = String(text || '');
  if (!list.length) return [src];
  const byName = new Map(list.map((p) => [lower(p.username).replace(/\s+/g, ' ').trim(), p]));
  const out = [];
  let last = 0;
  for (const m of findMentions(src, [...byName.keys()])) {
    if (!m.known) continue;
    if (m.start > last) out.push(src.slice(last, m.start));
    out.push({ person: byName.get(m.key), text: src.slice(m.start, m.end) });
    last = m.end;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

const LABELS = {
  get_current_workspace: 'Checked the workspace', get_user_channels: 'Listed channels', get_workspace_members: 'Looked up members',
  send_message_to_channel: 'Posted in a channel', send_direct_message: 'Sent a message', create_task: 'Created a task',
  list_my_tasks: 'Read your tasks', update_task_status: 'Updated a task', create_note: 'Created a note', make_task_from_note: 'Made a task from a note', make_task_from_file: 'Made a task from a file', list_recent_notes: 'Read your notes',
  search_workspace: 'Searched the workspace', schedule_meeting: 'Scheduled a meeting', search_messages_with_person: 'Searched your messages',
  remember_about_user: 'Saved to memory', forget_about_user: 'Updated memory',
  create_thread: 'Started a thread', reply_in_thread: 'Replied in a thread', append_to_note: 'Updated a note', set_reminder: 'Set a reminder',
};

/**
 * The server's actionsExecuted ([{ function, parameters, result }]) as chips:
 * [{ ok, label, error?, sent?: { to, toUserId, text, dmId } }]. A message the assistant sent
 * for you carries exactly what was sent, so the chat can show it.
 */
export function mapAiActions(list) {
  return (list || []).map((a) => {
    const result = a?.result && typeof a.result === 'object' ? a.result : {};
    const ok = a?.success !== false && !a?.error && result.success !== false;
    const name = a?.function || a?.tool || a?.name;
    const base = LABELS[name] || a?.summary || a?.label || a?.description || (name ? String(name).replace(/_/g, ' ') : 'Action');
    const label = name === 'send_direct_message' && ok && result.to ? `Sent to ${result.to}` : base;
    return {
      ok,
      label,
      ...(!ok && (result.error || a?.error) ? { error: result.error || a.error } : {}),
      ...(name === 'send_direct_message' && ok && result.sent
        ? { sent: { to: result.to, toUserId: result.toUserId || null, text: result.sent, dmId: result.dmSessionId || null } }
        : {}),
    };
  });
}
