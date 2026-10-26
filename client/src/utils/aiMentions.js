// @mentions of people in AI chats (the Oruinwan AI panel and chats with agents).
//
// A chosen person is kept as a structured mention { id, name, username } and sent
// to the server with the question, so the assistant knows exactly who is meant
// (it can message them, or search our own conversation with them). The text keeps
// "@username" so the question still reads naturally.
//
// Messages are end-to-end encrypted: for "search our conversation" the app sends
// the recent messages of our DM with that person, decrypted here (transcriptFor).

import { messageService } from '../services/messageService';
import { batchDecryptMessages } from '../services/messageEncryptionService';
import { mentionedPeople } from '@platform/people/mentions.js';

const ASSISTANT_HANDLES = /^(ai|oruinwan(?:[-_]?ai)?|claude|chatgpt|gpt|gemini|grok|local)$/i;

/** The "@que" being typed before the caret: { query, start, end }, or null. */
export function mentionQueryAt(text, caret = String(text || '').length) {
    const before = String(text || '').slice(0, caret);
    const m = /(^|[\s(])@([\w.-]*)$/.exec(before);
    if (!m) return null;
    return { query: m[2].toLowerCase(), start: caret - m[2].length - 1, end: caret };
}

const lower = (s) => String(s || '').toLowerCase();

/** Members matching the query: usernames starting with it first, then names/usernames containing it. */
export function suggestPeople(members, query, { me = null, limit = 6 } = {}) {
    const q = lower(query);
    const people = (members || []).filter((m) => m && (m._id || m.id) && m.username && String(m._id || m.id) !== String(me));
    const starts = people.filter((m) => lower(m.username).startsWith(q) || lower(m.name).split(/\s+/).some((w) => w.startsWith(q)));
    const contains = people.filter((m) => !starts.includes(m) && (lower(m.username).includes(q) || lower(m.name).includes(q)));
    return [...starts, ...contains].slice(0, limit).map((m) => ({ id: String(m._id || m.id), username: m.username, name: m.name || m.username, profilePicture: m.profilePicture || null }));
}

/** Put "@username " in place of the query: { text, caret }. */
export function insertMention(text, at, person) {
    const value = String(text || '');
    const tag = `@${person.username} `;
    const next = `${value.slice(0, at.start)}${tag}${value.slice(at.end).replace(/^ /, '')}`;
    return { text: next, caret: at.start + tag.length };
}

const hasHandle = (text, username) => new RegExp(`(^|[^\\w@])@${String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(String(text || ''));

/** The chosen people still mentioned in the text (a deleted "@name" drops the person). */
export function mentionsInText(text, chosen) {
    const seen = new Set();
    return (chosen || []).filter((p) => p?.id && p.username && hasHandle(text, p.username) && !seen.has(p.id) && seen.add(p.id));
}

/**
 * People named in a message's "@handle" list (the chat composer's mentionText, or
 * the text itself), looked up among `members`. Assistants (@ai, @claude…) are skipped.
 */
export function peopleFromHandles(textOrHandles, members) {
    // Names may have spaces ("@Pakanati Shiva Kumar Goud"): the longest known name wins.
    const people = (members || []).filter((m) => m?.username && !ASSISTANT_HANDLES.test(m.username));
    const out = [];
    const seen = new Set();
    for (const m of mentionedPeople(textOrHandles, people)) {
        const id = String(m._id || m.id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, username: m.username, name: m.name || m.username });
    }
    return out;
}

/**
 * Our recent messages with `person` (their 1:1 DM, from `dms` = the contacts list),
 * decrypted on this device: [{ from, isMe, text, at }]. [] when there is no DM or it
 * can't be read. Never throws.
 */
export async function transcriptFor(person, { workspaceId, dms = [], me, limit = 100 } = {}) {
    const dm = (dms || []).find((d) => !d.isGroup && String(d.userId) === String(person.id));
    if (!dm || !workspaceId) return [];
    try {
        const res = await messageService.getDMMessages(workspaceId, dm.id, limit);
        const messages = (res?.data?.messages || []).filter((m) => !m.parentId && m.type !== 'system' && !m.isDeleted && !m.deletedAt);
        const decrypted = await batchDecryptMessages(messages, dm.id, 'dm');
        return decrypted
            .filter((m) => m.isDecryptable && typeof m.decryptedContent === 'string' && m.decryptedContent.trim())
            .map((m) => {
                const senderId = String(m.sender?._id || m.sender || '');
                const isMe = senderId === String(me);
                return { from: isMe ? 'You' : (m.sender?.username || person.name), isMe, text: m.decryptedContent.slice(0, 600), at: m.createdAt || null };
            });
    } catch {
        return [];
    }
}

/** Mentions for the request: up to 5 people, each with our decrypted transcript when we have a DM. */
export async function withTranscripts(people, opts) {
    const list = (people || []).slice(0, 5);
    return Promise.all(list.map(async (p) => {
        const transcript = await transcriptFor(p, opts);
        return { id: p.id, name: p.name, ...(transcript.length ? { transcript } : {}) };
    }));
}
