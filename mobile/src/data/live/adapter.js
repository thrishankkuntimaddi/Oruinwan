// Live adapter: a self-hosted Oruinwan server. Same interface as ../demo/adapter.js;
// every server shape is mapped into the app's own models here and nowhere else.
import { api, absolute, accessToken, configure, loadTokens, saveTokens, serverUrl, request, ApiError } from './http.js';
import {
  conversationKey, encryptText, forgetIdentity, prefetchWorkspaceKeys, readMessage, restoreIdentity, unlockIdentity, decryptPayload,
} from './crypto.js';
import { connectRealtime, disconnectRealtime, joinWorkspace, socketEmit } from './realtime.js';
import { prefs } from '../../native/storage.js';
import { useE2ee } from '../e2ee.js';
import { normalizeServerUrl } from './server.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

let me = null;
let currentWs = null;
const dmCache = new Map(); // dmId → mapped DM (for participants when creating keys)

// ---------------------------------------------------------------- mapping

function presenceOf(u) {
  if (u.isOnline === false || u.status === 'offline') return 'offline';
  const s = u.userStatus || u.status;
  if (s === 'away' || s === 'idle') return 'away';
  if (s === 'dnd' || s === 'busy') return 'dnd';
  return u.isOnline || s === 'online' || s === 'active' ? 'active' : 'offline';
}

export function mapUser(u) {
  if (!u) return null;
  return {
    id: idOf(u),
    name: u.profile?.name && u.profile.name !== u.username ? u.profile.name : u.username || u.email || 'Unknown',
    username: u.username,
    email: u.email,
    avatarUrl: absolute(u.profilePicture),
    title: u.jobTitle || null,
    about: u.about ?? u.profile?.about ?? '',
    presence: presenceOf(u),
  };
}

function mapWorkspace(w) {
  return {
    id: idOf(w),
    name: w.name,
    description: w.description,
    color: w.color || '#b8956a',
    icon: w.icon,
    memberCount: w.memberCount,
    role: w.role,
    isPersonal: Boolean(w.isPersonal),
    unread: w.unreadCount || 0,
  };
}

function mapChannel(c) {
  const memberIds = (c.members || []).map((m) => idOf(m.user || m)).filter(Boolean);
  return {
    id: idOf(c),
    name: c.name,
    topic: c.description || '',
    isMember: c.isMember !== false,
    private: Boolean(c.isPrivate),
    broadcast: Boolean(c.isBroadcast || c.postingPolicy === 'admins' || c.name === 'announcements'),
    muted: Boolean(c.isMuted || c.muted),
    unread: c.unreadCount || 0,
    mentions: c.mentionCount || 0,
    memberCount: memberIds.length || c.memberCount || 0,
    memberIds,
    lastAt: c.lastMessageAt || null,
    lastText: null, // message bodies are end-to-end encrypted; the topic is shown instead
  };
}

function mapReactions(list) {
  const out = {};
  for (const r of list || []) {
    if (!r?.emoji) continue;
    (out[r.emoji] ||= []).push(idOf(r.userId || r.user));
  }
  return out;
}

async function mapMessage(conv, m) {
  const { text, state } = await readMessage(conv, m);
  return {
    id: idOf(m),
    convId: conv.id,
    authorId: idOf(m.sender) || m.senderId,
    author: m.sender && typeof m.sender === 'object' ? mapUser(m.sender) : null,
    text,
    state,
    at: m.createdAt,
    reactions: mapReactions(m.reactions),
    replyCount: m.replyCount || 0,
    replyUserIds: (m.threadParticipants || []).map(idOf),
    lastReplyAt: m.lastReplyAt || null,
    parentId: idOf(m.parentId),
    edited: Boolean(m.editedAt),
    pinned: Boolean(m.isPinned),
  };
}

const mapMessages = (conv, list) => Promise.all((list || []).map((m) => mapMessage(conv, m)));

function chronological(list) {
  return [...list].sort((a, b) => new Date(a.at) - new Date(b.at));
}

function mapTask(t) {
  const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  return {
    id: idOf(t),
    title: t.title,
    description: t.description || '',
    status: t.status,
    priority: t.priority || 'medium',
    due: t.dueDate || null,
    assigneeIds: (t.assignedTo || []).map(idOf),
    createdBy: idOf(t.createdBy),
    project: t.project?.name || t.issueKey || null,
    subtasks: subtasks.length ? { done: subtasks.filter((s) => s.status === 'done').length, total: subtasks.length } : null,
    comments: t.commentsCount || 0,
    blockedReason: t.blockedReason || null,
    updatedAt: t.updatedAt,
    channelId: idOf(t.channel),
  };
}

function mapNote(n) {
  return {
    id: idOf(n),
    title: n.title || 'Untitled',
    type: n.type || 'note',
    content: n.content || '',
    pinned: Boolean(n.isPinned),
    archived: Boolean(n.isArchived),
    ownerId: idOf(n.owner),
    sharedWith: (n.sharedWith || []).map((s) => idOf(s.user || s)),
    visibility: n.isPublic ? 'workspace' : n.sharedWith?.length ? 'shared' : 'private',
    updatedAt: n.updatedAt,
  };
}

const NOTIF_TYPE = {
  mention: 'mention', dm: 'dm', direct_message: 'dm', thread_reply: 'thread', reaction: 'reaction',
  meeting_reminder: 'meeting', schedule_created: 'meeting', huddle_started: 'meeting', note_shared: 'note',
};

function targetOf(n) {
  const meta = n.meta || {};
  if (meta.taskId) return { kind: 'task', id: String(meta.taskId) };
  if (meta.noteId) return { kind: 'note', id: String(meta.noteId) };
  if (meta.dmSessionId) return { kind: 'dm', id: String(meta.dmSessionId) };
  if (meta.parentId && meta.channelId) return { kind: 'thread', id: String(meta.parentId), conv: String(meta.channelId) };
  if (meta.channelId) return { kind: 'channel', id: String(meta.channelId) };
  const link = n.link || '';
  const ch = link.match(/channels?\/([0-9a-f]{24})/i);
  if (ch) return { kind: 'channel', id: ch[1] };
  const dm = link.match(/dm\/([0-9a-f]{24})/i);
  if (dm) return { kind: 'dm', id: dm[1] };
  return null;
}

function mapNotification(n) {
  return {
    id: idOf(n),
    type: n.type?.startsWith('task') ? 'task' : NOTIF_TYPE[n.type] || 'note',
    actorId: idOf(n.actor || n.sender || n.meta?.actorId || n.meta?.senderId),
    actorName: n.meta?.assignerUsername || n.meta?.senderUsername || n.meta?.senderName || n.meta?.actorName || (n.title || '').split(' ')[0],
    title: n.title,
    text: n.title,
    preview: n.body || '',
    at: n.createdAt,
    read: Boolean(n.read),
    target: targetOf(n),
  };
}

function fileKind(f) {
  const t = `${f.mimeType || f.type || ''} ${f.name || ''}`.toLowerCase();
  if (/image|\.png|\.jpe?g|\.gif|\.webp/.test(t)) return 'image';
  if (/sheet|excel|csv|\.xlsx?/.test(t)) return 'sheet';
  if (/pdf/.test(t)) return 'pdf';
  return 'doc';
}

// ---------------------------------------------------------------- AI

let streamUnavailable = false;

async function streamAi(body, { onToken, onTool, signal }) {
  if (streamUnavailable) throw new ApiError('stream unavailable', 0, null);
  // Streaming needs the browser's fetch (CapacitorHttp buffers whole responses), which in turn
  // needs the server to allow the app's origin. When it doesn't, the caller falls back.
  const webFetch = window.CapacitorWebFetch || window.fetch;
  const res = await webFetch(`${serverUrl()}/api/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${accessToken()}`, 'x-client-platform': 'android' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError('stream unavailable', res.status, null);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let done = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = chunk.match(/^event: (.*)$/m)?.[1] || 'message';
      const dataLine = chunk.match(/^data: (.*)$/m)?.[1];
      if (!dataLine) continue;
      let data;
      try {
        data = JSON.parse(dataLine);
      } catch {
        continue;
      }
      if (event === 'token') {
        text += data.t || '';
        onToken?.(text);
      } else if (event === 'tool') onTool?.(data.status === 'running' ? `Using ${data.name}` : null);
      else if (event === 'done') done = data;
      else if (event === 'error') throw new ApiError(data.message || 'Oruinwan AI could not answer.', 500, data);
    }
  }
  return { text: done?.text || text, actionsExecuted: done?.actionsExecuted, sources: done?.sources };
}

function aiError(err) {
  const code = err?.data?.code || err?.code;
  if (code === 'AI_NOT_CONFIGURED' || code === 'AI_ENGINE_UNAVAILABLE' || err?.status === 503) {
    return new Error("Oruinwan AI isn't set up on this server yet. A workspace admin can connect a model under Settings → Oruinwan AI on the web.");
  }
  return err;
}

function mapActions(list) {
  return (list || []).map((a) => ({ ok: a.success !== false && !a.error, label: a.summary || a.label || a.description || a.tool || a.name || 'Action' }));
}

function mapSources(list) {
  return (list || [])
    .map((s) => ({ kind: s.type || s.kind, id: idOf(s.id || s._id), label: s.title || s.label || s.name }))
    .filter((s) => s.id && ['task', 'note', 'channel', 'dm'].includes(s.kind));
}

// ---------------------------------------------------------------- adapter

async function afterSignIn(user) {
  me = user;
  prefs.set('live.user', user);
  connectRealtime(serverUrl());
}

export const liveAdapter = {
  kind: 'live',
  serverUrl,

  /** Throws { code: '2FA_REQUIRED' } when the account needs a one-time code. */
  async signIn({ server, email, password, otp }) {
    configure(normalizeServerUrl(server));
    let data;
    try {
      data = await request('POST', '/auth/login', { body: { email, password, ...(otp ? { otp } : {}) }, auth: false });
    } catch (err) {
      if (err.data?.requires2FA) {
        throw Object.assign(new Error('Enter the code from your authenticator app.'), { code: '2FA_REQUIRED', invalidCode: Boolean(err.data.invalidCode) });
      }
      if (err.data?.requiresReactivation) throw new Error('This account is deactivated. Reactivate it from the web app first.');
      if (err.status === 400 || err.status === 401) throw new Error('That email and password do not match.');
      throw err;
    }
    if (!data?.accessToken || !data?.refreshToken) throw new Error('The server did not return a mobile session. Update your Oruinwan server.');
    await saveTokens({ access: data.accessToken, refresh: data.refreshToken });
    const user = mapUser(await api.get('/auth/me').catch(() => data.user));
    await afterSignIn(user);
    // Unlock or create encryption keys with the password the user just typed.
    try {
      await unlockIdentity(user.id, password);
    } catch {
      /* status is shown in Chats; messaging asks for the password again */
    }
    return { user };
  },

  async restore({ server }) {
    configure(server);
    if (!(await loadTokens())) throw new Error('Not signed in');
    let user;
    let offline = false;
    try {
      user = mapUser(await api.get('/auth/me'));
    } catch (err) {
      if (!err.network) throw err;
      user = prefs.get('live.user');
      offline = true;
      if (!user) throw err;
    }
    await afterSignIn(user);
    await restoreIdentity(user.id);
    return { user, offline };
  },

  async unlock(password) {
    return unlockIdentity(me.id, password);
  },

  async signOut() {
    const tokensBefore = await loadTokens();
    disconnectRealtime();
    try {
      if (tokensBefore?.refresh) await request('POST', '/auth/logout', { body: { refreshToken: tokensBefore.refresh } });
    } finally {
      await forgetIdentity(me?.id);
      await saveTokens(null);
      prefs.set('live.user', null);
      me = null;
    }
  },

  onWorkspace(id) {
    currentWs = id;
    joinWorkspace(id);
    if (id && useE2ee.getState().status === 'ready') prefetchWorkspaceKeys(id);
  },

  async me() {
    return mapUser(await api.get('/auth/me'));
  },
  async updateMe({ name, about }) {
    const data = await api.put('/auth/me', { username: name, about });
    me = { ...me, ...mapUser(data?.user || data), about };
    prefs.set('live.user', me);
    return me;
  },
  async setPresence(presence) {
    await api.patch('/users/status', { status: presence });
    return presence;
  },

  async workspaces() {
    const data = await api.get('/workspaces/my');
    return (data.workspaces || []).map(mapWorkspace);
  },
  async members(ws) {
    const data = await api.get(`/workspaces/${ws}/members`);
    return (data.members || []).map(mapUser).sort((a, b) => a.name.localeCompare(b.name));
  },

  async channels(ws) {
    const data = await api.get(`/workspaces/${ws}/channels`);
    return (data.channels || []).map(mapChannel);
  },
  async joinChannel(id) {
    await api.post(`/channels/${id}/join`);
  },
  async leaveChannel(id) {
    await api.post(`/channels/${id}/exit`);
  },
  async setChannelMuted(id, muted) {
    if (muted) await api.post(`/channels/${id}/mute`, {});
    else await api.del(`/channels/${id}/mute`);
  },
  async createChannel(ws, { name, topic, isPrivate }) {
    const data = await api.post('/channels', { name, description: topic, isPrivate, workspaceId: ws });
    return mapChannel({ ...data.channel, isMember: true });
  },

  async dms(ws) {
    const data = await api.get(`/v2/messages/workspace/${ws}/dms`);
    const list = await Promise.all(
      (data.sessions || []).map(async (s) => {
        const user = mapUser(s.otherUser) || { id: s.otherUserId, name: 'Unknown', presence: 'offline' };
        const dm = { id: idOf(s), userId: user.id, user, unread: s.unreadCount || 0, lastAt: s.lastMessageAt || null, lastText: null };
        if (s.lastMessagePreview?.ciphertext && useE2ee.getState().status === 'ready') {
          try {
            const key = await conversationKey({ kind: 'dm', id: dm.id });
            dm.lastText = await decryptPayload(key, s.lastMessagePreview);
          } catch {
            dm.lastText = null;
          }
        }
        dmCache.set(dm.id, dm);
        return dm;
      }),
    );
    return list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  },
  async openDm(ws, userId) {
    const data = await api.get(`/v2/messages/workspace/${ws}/dm/resolve/${userId}`);
    return String(data.dmSessionId);
  },

  async messages(conv) {
    const ws = currentWs;
    const data =
      conv.kind === 'channel'
        ? await api.get(`/v2/messages/channel/${conv.id}`, { limit: 50 })
        : await api.get(`/v2/messages/workspace/${ws}/dm/${conv.id}`, { limit: 50 });
    const items = chronological(await mapMessages(conv, data.messages));
    return { items: items.filter((m) => !m.parentId), hasMore: Boolean(data.hasMore) };
  },
  async thread(conv, parentId) {
    const data = await api.get(`/v2/messages/thread/${parentId}`);
    return {
      parent: data.parent ? await mapMessage(conv, data.parent) : null,
      replies: chronological(await mapMessages(conv, data.replies)),
    };
  },
  async sendMessage(conv, text, { parentId, clientTempId } = {}) {
    const dm = dmCache.get(conv.id);
    const key = await conversationKey(conv, {
      workspaceId: currentWs,
      participantIds: dm ? [me.id, dm.userId] : undefined,
      create: conv.kind === 'dm',
    }).catch((err) => {
      throw new Error(useE2ee.getState().status !== 'ready' ? 'Unlock your messages first (Chats → Unlock).' : err.message);
    });
    const body = { ...(await encryptText(key, text)), clientTempId };
    let data;
    if (parentId) data = await api.post(`/v2/messages/thread/${parentId}`, body);
    else if (conv.kind === 'channel') data = await api.post('/v2/messages/channel', { ...body, channelId: conv.id });
    else data = await api.post('/v2/messages/direct', { ...body, dmSessionId: conv.id });
    const saved = data.message || data.reply || data;
    return mapMessage(conv, saved);
  },
  async editMessage(conv, id, text) {
    const key = await conversationKey(conv);
    const { ciphertext, messageIv } = await encryptText(key, text);
    await api.patch(`/v2/messages/${id}`, { ciphertext, messageIv });
  },
  async deleteMessage(conv, id) {
    await api.del(`/v2/messages/${id}`, { scope: 'everyone' });
  },
  async react(conv, id, emoji, add) {
    if (add === false) await api.del(`/v2/messages/${id}/react`, { emoji });
    else await api.post(`/v2/messages/${id}/react`, { emoji });
  },
  async togglePin(conv, id) {
    const data = await api.post(`/v2/messages/${id}/pin`, {});
    return Boolean(data?.isPinned ?? data?.message?.isPinned ?? true);
  },
  async markRead(conv) {
    socketEmit('mark-chat-read', { type: conv.kind, id: conv.id });
  },

  async tasks(ws) {
    const data = await api.get('/v2/tasks', { workspaceId: ws });
    return (data.tasks || []).map(mapTask);
  },
  async task(id) {
    const data = await api.get(`/v2/tasks/${id}`);
    return mapTask(data.task || data);
  },
  async createTask(ws, data) {
    const ids = data.assigneeIds?.length ? data.assigneeIds : [me.id];
    const onlyMe = ids.length === 1 && ids[0] === me.id;
    const res = await api.post('/v2/tasks', {
      title: data.title,
      description: data.description,
      workspaceId: ws,
      priority: data.priority,
      dueDate: data.due || undefined,
      status: data.status,
      assignmentType: onlyMe ? 'self' : 'members',
      ...(onlyMe ? {} : { assignedToIds: ids, assignmentMode: 'shared' }),
      ...(data.channelId ? { channelId: data.channelId } : {}),
    });
    return mapTask(res.task || res.tasks?.[0]);
  },
  async updateTask(id, patch) {
    const body = { ...patch };
    if ('due' in body) {
      body.dueDate = body.due;
      delete body.due;
    }
    if (body.assigneeIds) {
      body.assignedTo = body.assigneeIds;
      delete body.assigneeIds;
    }
    const data = await api.put(`/v2/tasks/${id}`, body);
    return mapTask(data.task || data);
  },
  async trashTask(id) {
    await api.del(`/v2/tasks/${id}`);
  },

  async notes(ws) {
    const data = await api.get('/v2/notes', { workspaceId: ws });
    return (data.notes || []).map(mapNote).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },
  async note(id) {
    const data = await api.get(`/v2/notes/${id}`);
    return mapNote(data.note || data);
  },
  async createNote(ws, { title, type, content }) {
    const data = await api.post('/v2/notes', { title: title || 'Untitled', type, content, workspaceId: ws });
    return mapNote(data.note);
  },
  async updateNote(id, patch) {
    const body = {};
    if ('title' in patch) body.title = patch.title;
    if ('content' in patch) body.content = patch.content;
    if ('type' in patch) body.type = patch.type;
    if ('pinned' in patch) body.isPinned = patch.pinned;
    if ('archived' in patch) body.isArchived = patch.archived;
    if ('visibility' in patch) body.isPublic = patch.visibility === 'workspace';
    if ('sharedWith' in patch) body.sharedWith = patch.sharedWith;
    const data = await api.put(`/v2/notes/${id}`, body);
    return mapNote(data.note || data);
  },
  async archiveNote(id, archived = true) {
    return this.updateNote(id, { archived });
  },

  async knowledge(ws) {
    const data = await api.get('/v2/knowledge/pages', { workspaceId: ws, parentId: 'root' });
    return (data.pages || []).map((p) => ({
      id: idOf(p),
      parentId: null,
      title: p.title,
      icon: p.icon || '📄',
      updatedAt: p.updatedAt,
      excerpt: p.summary || p.excerpt || '',
    }));
  },
  async page(id) {
    const data = await api.get(`/v2/knowledge/pages/${id}`);
    const p = data.page || data;
    return { id: idOf(p), title: p.title, icon: p.icon || '📄', updatedAt: p.updatedAt, content: p.content || '' };
  },

  async files(ws) {
    const data = await api.get('/v2/files', { workspaceId: ws, folderId: 'root' });
    return (data.files || []).map((f) => ({
      id: idOf(f),
      name: f.name || f.originalName || 'File',
      size: f.size,
      kind: fileKind(f),
      owner: idOf(f.uploadedBy || f.owner),
      at: f.createdAt,
      url: null,
    }));
  },

  async notifications(ws) {
    const data = await api.get('/notifications', { workspaceId: ws, limit: 50 });
    return (data.notifications || []).map(mapNotification);
  },
  async markNotificationRead(id) {
    await api.patch(`/notifications/${id}/read`);
  },
  async markAllNotificationsRead(ws) {
    await api.patch('/notifications/read-all', {}, { workspaceId: ws });
  },

  async integrations(ws) {
    try {
      const data = await api.get('/v2/integrations', { workspaceId: ws });
      return (data.integrations || []).map((i) => ({
        id: i.provider || i.type || idOf(i),
        name: i.name || i.provider,
        description: i.description || '',
        connected: Boolean(i.connected ?? i.enabled ?? i.isActive),
        detail: i.account || i.detail || null,
        category: i.category || 'Connected apps',
      }));
    } catch (err) {
      if (err.status === 404 || err.code === 'FEATURE_DISABLED') return [];
      throw err;
    }
  },

  async sessions() {
    const data = await api.get('/auth/sessions');
    return (Array.isArray(data) ? data : data.sessions || []).map((s) => ({
      id: idOf(s),
      device: s.device && s.device !== 'Unknown device' ? s.device : s.osName || s.os || 'Device',
      os: s.osName || s.os || '',
      client: s.browser || '',
      lastActive: s.lastActive,
      current: Boolean(s.current),
      location: s.location || s.ip || '',
    }));
  },
  async revokeSession(id) {
    await api.del(`/auth/sessions/${id}`);
  },
  async revokeOtherSessions() {
    await api.del('/auth/sessions/others');
  },

  async notificationPrefs(ws) {
    const { preferences: p = {} } = await api.get('/notifications/preferences', { workspaceId: ws });
    return { messages: p.message !== false, threads: p.threadReply !== false, tasks: p.task !== false, meetings: p.meeting !== false, email: Boolean(p.email) };
  },
  async saveNotificationPrefs(ws, patch) {
    const map = { messages: 'message', threads: 'threadReply', tasks: 'task', meetings: 'meeting', email: 'email' };
    const body = Object.fromEntries(Object.entries(patch).map(([k, v]) => [map[k] || k, v]));
    await api.patch('/notifications/preferences', body, { workspaceId: ws });
  },
  async privacyPrefs() {
    const u = await api.get('/auth/me');
    const p = u.preferences?.privacy || {};
    return { readReceipts: p.readReceipts !== false, typingIndicator: p.typingIndicators !== false, discoverable: p.allowDiscovery !== false };
  },
  async savePrivacyPrefs(patch) {
    const map = { readReceipts: 'readReceipts', typingIndicator: 'typingIndicators', discoverable: 'allowDiscovery' };
    await api.put('/auth/me/preferences/privacy', Object.fromEntries(Object.entries(patch).map(([k, v]) => [map[k], v])));
  },
  async securityStatus() {
    const u = await api.get('/auth/me');
    return { twoFactor: Boolean(u.twoFactorEnabled), e2ee: useE2ee.getState().status, hasPassword: u.authProvider === 'local' || u.hasPassword };
  },

  async aiAsk(ws, history, { onToken, onTool, signal } = {}) {
    const last = history[history.length - 1]?.content || '';
    const body = { message: last, history: history.slice(0, -1).slice(-12), workspaceId: ws };
    let result;
    try {
      result = await streamAi(body, { onToken, onTool, signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (err instanceof ApiError && err.status && err.status !== 0 && err.status !== 404) throw aiError(err);
      // Streaming is unavailable (e.g. the server does not allow the app's origin): ask without it,
      // and don't retry streaming for the rest of this session.
      streamUnavailable = true;
      try {
        result = await api.post('/ai/chat', body);
      } catch (e) {
        throw aiError(e);
      }
      onToken?.(result.text || '');
    }
    return { text: result.text || '', actions: mapActions(result.actionsExecuted), sources: mapSources(result.sources), provider: result.provider };
  },

  async searchMessages() {
    // Message bodies are end-to-end encrypted, so the server cannot search them.
    return [];
  },
};
