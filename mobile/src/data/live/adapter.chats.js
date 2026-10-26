// Chats, threads, AI and search calls of the live adapter (merged into liveAdapter in
// adapter.js). Message text is end-to-end encrypted: everything sent to AI here is text the
// phone decrypted, and checklists are encrypted like any message (the server keeps only ticks).
import { absolute, api } from './http.js';
import { conversationKey, decryptPayload, encryptText, withCurrentKey } from './crypto.js';
import { useE2ee } from '../e2ee.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

// ---------------------------------------------------------------- mapping

/** A poll as the app models it. Voters are { id, name } (names only when the server sent them). */
export function mapPoll(p, sender) {
  if (!p || !Array.isArray(p.options)) return null;
  const options = p.options.map((o) => ({
    text: o.text || '',
    votes: (o.votes || []).map((v) => ({ id: idOf(v), name: typeof v === 'object' ? v.username || null : null })).filter((v) => v.id),
  }));
  const voters = new Set(options.flatMap((o) => o.votes.map((v) => v.id)));
  return {
    question: p.question || '',
    options,
    allowMultiple: Boolean(p.allowMultiple),
    anonymous: Boolean(p.anonymous),
    endDate: p.endDate || null,
    active: p.isActive !== false,
    totalVotes: Number.isFinite(p.totalVotes) ? Math.max(p.totalVotes, voters.size) : voters.size,
    createdBy: idOf(p.createdBy) || idOf(sender),
  };
}

/** Checked state of each checklist item (the labels are in the encrypted text). */
/** A message's reactions as { emoji: [userId] } (one entry per person per emoji). */
export function mapReactions(list) {
  const out = {};
  for (const r of list || []) {
    if (!r?.emoji) continue;
    const id = idOf(r.userId || r.user);
    if (!id || out[r.emoji]?.includes(id)) continue;
    (out[r.emoji] ||= []).push(id);
  }
  return out;
}

/** Names of the people who reacted, when the server sent them (people outside my directory). */
export function mapReactorNames(list) {
  const out = {};
  for (const r of list || []) {
    const u = r?.userId || r?.user;
    if (u && typeof u === 'object' && u.username) out[idOf(u)] = u.username;
  }
  return out;
}

export function mapChecklist(list) {
  return (list || []).map((i) => ({ checked: Boolean(i.checked), checkedBy: idOf(i.checkedBy), text: i.text || '' }));
}

/** Fields of a server message beyond the basics in adapter.js toAppMessage. */
export function messageExtras(m, meId) {
  const mine = (list) => Boolean(meId) && (list || []).some((v) => idOf(v) === String(meId));
  return {
    type: m.type || 'message',
    poll: m.type === 'poll' ? mapPoll(m.poll, m.sender) : null,
    checklist: m.type === 'checklist' ? mapChecklist(m.checklist) : null,
    saved: mine(m.bookmarkedBy),
    editCount: Array.isArray(m.editHistory) ? m.editHistory.length : 0,
    resolved: Boolean(m.resolvedThreadAt),
    following: mine(m.followers),
    linkedTaskId: idOf(m.linkedTaskId),
    // A reply copied from a task's discussion (server: tasks.threadSync.js): not edited here.
    fromTaskId: m.taskComment ? idOf(m.taskCommentTask) || '' : null,
  };
}

/** A checklist message's decrypted text: { title, items: [text] }, or null. */
export function parseChecklistText(text) {
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.items)) return null;
    return { title: String(data.title || ''), items: data.items.map((i) => String(typeof i === 'object' ? i?.text || '' : i)) };
  } catch {
    return null;
  }
}

/** The conversation a stored message belongs to: { kind, id }. */
export function convOf(m) {
  const channel = idOf(m?.channel);
  if (channel) return { kind: 'channel', id: channel, name: typeof m.channel === 'object' && m.channel.name ? `#${m.channel.name}` : null };
  const dm = idOf(m?.dm);
  return dm ? { kind: 'dm', id: dm, name: null } : null;
}

/**
 * GET /v2/messages/:id/info as the app models it (the same data the web's Message info shows):
 * { sentAt, editedAt, editCount, pinnedBy, pinnedAt, read: [person], unread: [person] } where a
 * person is { id, username, avatarUrl, readAt }. The sender is never in either list; readers who
 * hide their receipts are already left out by the server. readAt is null for reads recorded before
 * the server kept times.
 */
export function mapMessageInfo(data, senderId) {
  const d = data || {};
  const m = d.message || {};
  const sender = idOf(m.sender) || (senderId ? String(senderId) : null);
  const person = (u) => ({ id: idOf(u), username: (u && typeof u === 'object' && u.username) || 'Unknown', avatarUrl: u && typeof u === 'object' ? absolute(u.profilePicture) : null });
  const members = (Array.isArray(d.members) ? d.members : []).map(person).filter((u) => u.id);
  const byId = new Map(members.map((u) => [u.id, u]));
  const readUsers = Array.isArray(d.readByUsers) ? d.readByUsers : Array.isArray(m.readByUsers) ? m.readByUsers : [];
  const read = [];
  const seen = new Set();
  for (const u of readUsers) {
    const own = person(u);
    const known = byId.get(own.id);
    const p = { ...own, username: own.username === 'Unknown' && known ? known.username : own.username, avatarUrl: own.avatarUrl || known?.avatarUrl || null, readAt: (u && typeof u === 'object' && u.readAt) || null };
    if (!p.id || p.id === sender || seen.has(p.id)) continue;
    seen.add(p.id);
    read.push(p);
  }
  for (const id of (Array.isArray(d.readBy) ? d.readBy : []).map(idOf)) {
    if (!id || id === sender || seen.has(id)) continue;
    seen.add(id);
    read.push({ ...(byId.get(id) || { id, username: 'Unknown', avatarUrl: null }), readAt: null });
  }
  read.sort((a, b) => String(b.readAt || '').localeCompare(String(a.readAt || '')));
  const unread = members.filter((u) => u.id !== sender && !seen.has(u.id)).map((u) => ({ ...u, readAt: null }));
  return {
    sentAt: m.createdAt || null,
    editedAt: d.editedAt ?? m.editedAt ?? null,
    editCount: d.editCount ?? m.editCount ?? 0,
    pinnedBy: m.isPinned ? d.pinnedBy ?? m.pinnedBy ?? null : null,
    pinnedAt: m.isPinned ? d.pinnedAt ?? m.pinnedAt ?? null : null,
    recipients: members.filter((u) => u.id !== sender).length,
    read,
    unread,
  };
}

function mapTaskRef(t) {
  return t ? { id: idOf(t), title: t.title, status: t.status } : null;
}

const SEARCH_EMPTY = { knowledge: [], files: [], tasks: [], notes: [] };

// ---------------------------------------------------------------- calls

/**
 * helpers from adapter.js: { mapMessage(conv, serverMessage), me() → user, ws() → workspace id,
 * dm(id) → cached DM ({ userId }) }.
 */
export function chatsAdapter({ mapMessage, me, ws, dm }) {
  async function keyFor(conv) {
    const d = dm(conv.id);
    return conversationKey(conv, { workspaceId: ws(), participantIds: d ? d.participantIds || [me().id, d.userId] : undefined, create: conv.kind === 'dm' }).catch((err) => {
      throw new Error(useE2ee.getState().status !== 'ready' ? 'Unlock your messages first (Chats → Unlock).' : err.message);
    });
  }

  const mapStored = async (m) => {
    const conv = convOf(m);
    if (!conv) return null;
    return { conv, message: await mapMessage({ kind: conv.kind, id: conv.id }, m) };
  };

  return {
    // ---- Saved for later
    async toggleSave(conv, id) {
      const data = await api.post(`/v2/messages/${id}/bookmark`, {});
      return Boolean(data?.bookmarked);
    },
    /** Saved messages in this workspace, newest first: [{ conv, message }]. */
    async savedMessages(workspaceId) {
      const data = await api.get('/v2/messages/bookmarks', { limit: 100 });
      const list = (data.messages || []).filter((m) => !m.workspace || !workspaceId || idOf(m.workspace) === workspaceId);
      return (await Promise.all(list.map(mapStored))).filter(Boolean);
    },

    // ---- Reminders
    /** A reminder on a message, for me (or, with forUserId, for someone who can read it: /remind @person). */
    async remindMe(conv, id, at, note = '', { forUserId = null } = {}) {
      const data = await api.post(`/v2/messages/${id}/reminder`, { remindAt: new Date(at).toISOString(), note, ...(forUserId ? { forUserId } : {}) });
      return { id: idOf(data.reminder), at: data.reminder?.remindAt || at };
    },
    /** Reminders not yet delivered: [{ id, at, note, conv, message }]. */
    async reminders(workspaceId) {
      const data = await api.get('/v2/messages/reminders');
      const list = (data.reminders || []).filter((r) => {
        const w = r.messageId && typeof r.messageId === 'object' ? idOf(r.messageId.workspace) : null;
        return !w || !workspaceId || w === workspaceId;
      });
      return Promise.all(
        list.map(async (r) => {
          const stored = r.messageId && typeof r.messageId === 'object' ? await mapStored(r.messageId).catch(() => null) : null;
          return { id: idOf(r), at: r.remindAt, note: r.note || '', conv: stored?.conv || null, message: stored?.message || null };
        }),
      );
    },
    async cancelReminder(id) {
      await api.del(`/v2/messages/reminders/${id}`);
    },
    /** A reminder that fired (socket 'reminder-fired' / 'reminder:due'), decrypted for the banner. */
    async readReminder(payload) {
      const m = payload?.message && typeof payload.message === 'object' ? payload.message : null;
      const stored = m ? await mapStored(m).catch(() => null) : null;
      return { id: idOf(payload?.reminderId), note: payload?.note || '', conv: stored?.conv || null, message: stored?.message || null };
    },

    // ---- Edit history
    /** Every version, oldest first, decrypted here: { canRestore, versions: [{ index, version, at, text, current }] }. */
    async messageVersions(conv, id) {
      const data = await api.get(`/v2/messages/${id}/versions`);
      let key = null;
      try {
        key = await conversationKey(conv);
      } catch {
        key = null;
      }
      const read = async (v) => {
        if (!v.isEncrypted) return { text: v.text ?? '', state: 'ok' };
        if (!key || !v.ciphertext) return { text: '', state: 'locked' };
        try {
          return { text: await decryptPayload(key, v), state: 'ok' };
        } catch {
          return { text: '', state: 'failed' };
        }
      };
      const versions = await Promise.all(
        (data.versions || []).map(async (v) => ({ index: v.index, version: v.version, at: v.editedAt, current: false, ...(await read(v)) })),
      );
      const cur = data.current || {};
      versions.push({ index: null, version: cur.version || versions.length + 1, at: cur.editedAt, current: true, ...(await read(cur)) });
      return { canRestore: Boolean(data.canRestore), versions };
    },
    async restoreVersion(conv, id, versionIndex) {
      await api.post(`/v2/messages/${id}/restore`, { versionIndex });
    },

    // ---- Polls
    /** poll: { question, options: [text], allowMultiple, anonymous, endDate } */
    async createPoll(conv, poll) {
      const body = { poll, ...(conv.kind === 'channel' ? { channelId: conv.id } : { dmId: conv.id }) };
      const data = await api.post('/v2/messages/poll', body);
      return mapMessage(conv, data.message);
    },
    async votePoll(conv, id, optionIndices) {
      const data = await api.post(`/v2/messages/${id}/vote`, { optionIndices });
      return mapPoll(data.message?.poll, data.message?.sender);
    },
    async closePoll(conv, id) {
      const data = await api.post(`/v2/messages/${id}/poll/close`, {});
      return mapPoll(data.message?.poll, data.message?.sender);
    },

    // ---- Checklists
    /** { title, items: [text] } as an encrypted checklist message (not in threads: replies carry text only). */
    async sendChecklist(conv, { title, items }, { clientTempId } = {}) {
      const clean = items.map((i) => String(i).trim()).filter(Boolean).slice(0, 50);
      const data = await withCurrentKey(conv, () => keyFor(conv), async (key) => {
        const body = { ...(await encryptText(key, JSON.stringify({ title: title || '', items: clean }))), type: 'checklist', checklistCount: clean.length, clientTempId };
        if (conv.kind === 'channel') return api.post('/v2/messages/channel', { ...body, channelId: conv.id });
        return api.post('/v2/messages/direct', { ...body, dmSessionId: conv.id, workspaceId: ws() });
      });
      return mapMessage(conv, data.message || data);
    },
    async toggleChecklistItem(conv, id, index) {
      const data = await api.post(`/v2/messages/${id}/checklist/${index}`, {});
      return mapChecklist(data.checklist);
    },

    // ---- Message → task
    async convertToTask(conv, id, { title, description, priority, due }) {
      const data = await api.post(`/v2/messages/${id}/convert-task`, {
        title: String(title).slice(0, 200),
        ...(description?.trim() ? { description: description.trim() } : {}),
        ...(priority ? { priority } : {}),
        ...(due ? { dueDate: new Date(`${due}T00:00:00`).toISOString() } : {}),
      });
      return mapTaskRef(data.task);
    },

    // ---- Threads
    /** A thread with who took part, follow and resolve state. */
    async threadInfo(conv, parentId) {
      const data = await api.get(`/v2/messages/thread/${parentId}`);
      const replies = await Promise.all((data.replies || []).map((m) => mapMessage(conv, m)));
      return {
        parent: data.parent ? await mapMessage(conv, data.parent) : null,
        replies: replies.sort((a, b) => new Date(a.at) - new Date(b.at)),
        participants: (data.participants || []).map((p) => ({ id: idOf(p), username: p.username, avatarUrl: absolute(p.profilePicture), replyCount: p.replyCount || 0 })),
        resolved: Boolean(data.resolved),
        resolvedBy: data.resolvedBy ? { id: idOf(data.resolvedBy), username: data.resolvedBy.username } : null,
        following: Boolean(data.followStatus?.following),
        followerCount: data.followStatus?.followerCount || 0,
        locked: Boolean(data.lock?.locked),
        lockedBy: data.lock?.lockedBy ? { id: idOf(data.lock.lockedBy), username: data.lock.lockedBy.username || null } : null,
        canLock: Boolean(data.permissions?.canLock),
        canModerate: Boolean(data.permissions?.canModerate),
      };
    },
    /** Lock (no new replies) or unlock a thread: channel admins, workspace admins, or its starter. */
    async lockThread(parentId, locked) {
      const data = locked ? await api.post(`/threads/${parentId}/lock`, {}) : await api.del(`/threads/${parentId}/lock`);
      return { locked: Boolean(data?.locked), lockedBy: data?.lockedBy ? { id: idOf(data.lockedBy), username: data.lockedBy.username || null } : null };
    },
    /** { followers: [{ id, username, avatarUrl }], canModerate }. */
    async threadFollowers(parentId) {
      const data = await api.get(`/threads/${parentId}/followers`);
      return {
        followers: (data.followers || []).map((f) => ({ id: idOf(f), username: f.username || null, avatarUrl: absolute(f.profilePicture) })),
        canModerate: Boolean(data.canModerate),
      };
    },
    /** Adds people who can see the conversation; they're notified. Returns { added, skipped }. */
    async addThreadFollowers(parentId, userIds) {
      const data = await api.post(`/threads/${parentId}/followers`, { userIds });
      return { added: (data.added || []).map(String), skipped: (data.skipped || []).map(String), followerCount: data.followerCount ?? null };
    },
    async removeThreadFollower(parentId, userId) {
      const data = await api.del(`/threads/${parentId}/followers/${userId}`);
      return { followerCount: data?.followerCount ?? null };
    },
    async followThread(parentId, follow) {
      const data = follow ? await api.post(`/threads/${parentId}/follow`, {}) : await api.del(`/threads/${parentId}/follow`);
      return { following: Boolean(data?.following ?? follow), followerCount: data?.followerCount ?? null };
    },
    /** Toggles resolved; returns the new state. */
    async resolveThread(parentId) {
      const data = await api.post(`/threads/v2/${parentId}/resolve`, {});
      return Boolean(data?.isResolved ?? data?.resolved);
    },

    // ---- AI on decrypted messages
    /** messages: [{ sender, text }] (decrypted here). */
    async summarizeThread(workspaceId, parentId, parentText, replies) {
      const data = await api.post('/v2/messages/ai/thread-summary', { workspaceId, parentMessageId: parentId, parentText, replies: replies.slice(-200) });
      return data.summary || '';
    },
    /** mode: summary | bullets | action_items. messages: [{ sender, text, isMe }]. */
    async summarizeConversation(workspaceId, messages, { title, mode = 'summary' } = {}) {
      const data = await api.post('/ai/conversation', { workspaceId, messages: messages.slice(-200), mode, title });
      return data.text || '';
    },
    /** A question about a conversation, answered from its messages (decrypted here). */
    async askAboutConversation(workspaceId, messages, question, { title } = {}) {
      const data = await api.post('/ai/conversation', { workspaceId, messages: messages.slice(-200), mode: 'question', question, title });
      return data.text || '';
    },
    async smartReplies(workspaceId, messages) {
      const data = await api.post('/ai/smart-replies', { workspaceId, messages: messages.slice(-8) });
      return (data.suggestions || []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3);
    },
    async translate(workspaceId, text, targetLang) {
      const data = await api.post('/v2/messages/ai/translate', { workspaceId, text: String(text).slice(0, 5000), targetLang });
      if (!data?.translated) throw new Error('No translation came back.');
      return { text: data.translated, detectedLang: data.detectedLang || null };
    },
    /** Q&A over the workspace's knowledge pages and meeting notes. */
    async askKnowledge(workspaceId, question) {
      const data = await api.post('/ai/ask', { workspaceId, question });
      return {
        answer: data.answer || '',
        fallback: Boolean(data.fallback),
        references: (data.references || []).map((r) => ({ kind: r.type === 'knowledge' ? 'page' : r.type, id: idOf(r.id), label: r.title || 'Untitled' })).filter((r) => r.id),
      };
    },

    // ---- Channels
    /** Who may use @channel/@here: { broadcastMentions, canManage, postingPolicy, muted }. */
    async channelPolicy(id) {
      const data = await api.get(`/channels/${id}/mute`);
      return { broadcastMentions: data.broadcastMentions || 'everyone', canManage: Boolean(data.canManage), postingPolicy: data.postingPolicy || 'everyone', muted: Boolean(data.isMuted) };
    },
    /** A channel's threads, newest activity first (the web's Threads view). */
    async channelThreads(channelId) {
      const conv = { kind: 'channel', id: channelId };
      const data = await api.get(`/threads/channels/${channelId}/threads`);
      const list = await Promise.all((data.threads || []).map(async (m) => ({
        ...(await mapMessage(conv, m)),
        following: Boolean(m.following),
        unread: m.unread || 0,
        locked: Boolean(m.locked),
      })));
      return list.sort((a, b) => String(b.lastReplyAt || b.at || '').localeCompare(String(a.lastReplyAt || a.at || '')));
    },

    // ---- Conversation tools (the web's header menu)
    /** Pinned messages of a channel or DM, decrypted here. */
    async pinnedMessages(conv) {
      const data = await api.get('/v2/messages/pinned', conv.kind === 'channel' ? { channelId: conv.id } : { dmId: conv.id });
      return Promise.all((data.messages || []).map((m) => mapMessage(conv, m)));
    },
    /** Who has read one of my messages, and who hasn't yet. */
    async messageInfo(conv, id, senderId) {
      return mapMessageInfo(await api.get(`/v2/messages/${id}/info`), senderId);
    },
    /** A DM's mute and block state: { muted, blocked, blockedByOther, isGroup }. */
    async dmStatus(id) {
      const data = await api.get(`/v2/dm/${id}/status`);
      return { muted: Boolean(data.isMuted), blocked: Boolean(data.isBlocked), blockedByOther: Boolean(data.isBlockedByOther), isGroup: Boolean(data.isGroup) };
    },
    async setDmMuted(id, muted) {
      if (muted) await api.post(`/v2/dm/${id}/mute`, {});
      else await api.del(`/v2/dm/${id}/mute`);
    },
    /** Not for group DMs (leave the group instead). */
    async setDmBlocked(id, blocked) {
      if (blocked) await api.post(`/v2/dm/${id}/block`, {});
      else await api.del(`/v2/dm/${id}/block`);
    },
    /** Hides everything sent so far, for me only. */
    async clearDm(id) {
      await api.post(`/v2/dm/${id}/clear`, {});
    },
    /** Removes the DM from my list and clears it for me; a new message brings it back. */
    async deleteDm(id) {
      await api.del(`/v2/dm/${id}`);
    },

    // ---- Server search (pages, files, tasks, notes: not end-to-end encrypted)
    /** kind: 'knowledge' | 'file' | 'task' | 'note'; params from lib/searchQuery serverParams. */
    async searchServer(workspaceId, params) {
      if (!params.q) return SEARCH_EMPTY;
      const data = await api.get('/search', { ...params, workspaceId, limit: 30 });
      return {
        knowledge: (data.knowledge || []).map((p) => ({ id: idOf(p.id), title: p.title || 'Untitled page', icon: p.icon || '📄', snippet: p.snippet || '', at: p.createdAt })),
        files: (data.files || []).map((f) => ({ id: idOf(f.id), name: f.name || 'File', mimeType: f.mimeType || '', size: f.size ?? null, url: f.url || null, owner: f.createdBy?.name || null, at: f.createdAt })),
        tasks: (data.tasks || []).map((t) => ({ id: idOf(t.id), title: t.title || 'Task', status: t.status || null, at: t.createdAt })),
        notes: (data.notes || []).map((n) => ({ id: idOf(n.id), title: n.title || 'Untitled', snippet: n.snippet || n.preview || '', at: n.createdAt })),
      };
    },
  };
}
