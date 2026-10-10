// Demo workspace: the full app, offline, with sample data that lives only on this device.
// It implements the same interface as the live adapter (see ../live/adapter.js).
import { buildSeed } from './seed.js';
import { prefs } from '../../native/storage.js';
import { uid } from '../../lib/id.js';
import { emit } from '../../lib/bus.js';
import { TASK_TRANSITIONS } from '../constants.js';
import { answerDemoQuestion } from './ai.js';

const STORE_KEY = 'demo.state.v1';
let state = null;
let saveTimer = null;

function db() {
  if (!state) state = prefs.get(STORE_KEY) || buildSeed();
  return state;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => prefs.set(STORE_KEY, state), 250);
}

const wait = (ms = 140 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function user(id) {
  const u = db().users[id];
  return u ? { ...u, avatarUrl: null } : { id, name: 'Unknown', presence: 'offline' };
}

function lastMessage(convId) {
  const list = db().messages.filter((m) => m.conv === convId);
  return list[list.length - 1] || null;
}

function toMessage(m) {
  return {
    id: m.id,
    convId: m.conv,
    authorId: m.author,
    text: m.text,
    at: m.at,
    reactions: m.reactions || {},
    replyCount: m.replyCount || 0,
    replyUserIds: m.replyIds || [],
    lastReplyAt: m.lastReplyAt || null,
    parentId: m.parentId || null,
    edited: Boolean(m.edited),
    pinned: Boolean(m.pinned),
    saved: Boolean(m.saved),
    state: 'ok',
  };
}

function toChannel(c) {
  const last = lastMessage(c.id);
  return {
    id: c.id,
    name: c.name,
    topic: c.topic,
    isMember: c.isMember,
    private: Boolean(c.private),
    broadcast: Boolean(c.broadcast),
    muted: Boolean(c.muted),
    unread: c.isMember ? c.unread || 0 : 0,
    mentions: c.mentions || 0,
    memberCount: c.memberIds.length,
    memberIds: c.memberIds,
    lastAt: last?.at || null,
    lastText: last ? `${user(last.author).name.split(' ')[0]}: ${last.text}` : null,
  };
}

function toDm(d) {
  const otherId = d.memberIds.find((id) => id !== 'me') || 'me';
  const last = lastMessage(d.id);
  return {
    id: d.id,
    userId: otherId,
    user: user(otherId),
    unread: d.unread || 0,
    lastAt: last?.at || null,
    lastText: last ? `${last.author === 'me' ? 'You: ' : ''}${last.text}` : null,
  };
}

function toTask(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: t.status,
    priority: t.priority,
    due: t.due || null,
    assigneeIds: t.assignees || [],
    createdBy: t.createdBy,
    project: t.project || null,
    subtasks: t.subtasks ? { done: t.subtasks[0], total: t.subtasks[1] } : null,
    comments: t.comments || 0,
    blockedReason: t.blockedReason || null,
    updatedAt: t.updatedAt,
    channelId: t.channelId || null,
  };
}

function toNote(n) {
  return {
    id: n.id,
    title: n.title,
    type: n.type,
    content: n.content,
    pinned: Boolean(n.pinned),
    archived: Boolean(n.archived),
    ownerId: n.owner,
    sharedWith: n.sharedWith || [],
    visibility: n.visibility || (n.sharedWith?.length ? 'shared' : 'private'),
    updatedAt: n.updatedAt,
  };
}

function changed(...keys) {
  save();
  emit('data:changed', keys);
}

export const demoAdapter = {
  kind: 'demo',

  async restore() {
    await wait(60);
    return { user: user('me') };
  },
  async signOut() {
    await wait(80);
  },
  async me() {
    await wait();
    return user('me');
  },
  async updateMe(patch) {
    await wait();
    Object.assign(db().users.me, patch);
    changed('me');
    return user('me');
  },
  async setPresence(presence) {
    db().users.me.presence = presence;
    changed('me');
    return presence;
  },

  async workspaces() {
    await wait();
    return db().workspaces.map((w) => {
      const unread =
        db().channels.filter((c) => c.ws === w.id && c.isMember && !c.muted).reduce((a, c) => a + (c.unread || 0), 0) +
        db().dms.filter((d) => d.ws === w.id).reduce((a, d) => a + (d.unread || 0), 0);
      return { ...w, unread };
    });
  },
  async members(ws) {
    await wait();
    const ids = new Set(db().channels.filter((c) => c.ws === ws).flatMap((c) => c.memberIds));
    return [...ids].map(user).sort((a, b) => a.name.localeCompare(b.name));
  },
  async users() {
    return Object.fromEntries(Object.keys(db().users).map((id) => [id, user(id)]));
  },

  async channels(ws) {
    await wait();
    return db().channels.filter((c) => c.ws === ws).map(toChannel);
  },
  async channel(id) {
    await wait(80);
    const c = db().channels.find((x) => x.id === id);
    if (!c) throw new Error('Channel not found');
    return toChannel(c);
  },
  async joinChannel(id) {
    await wait();
    const c = db().channels.find((x) => x.id === id);
    c.isMember = true;
    if (!c.memberIds.includes('me')) c.memberIds.push('me');
    changed('channels');
  },
  async leaveChannel(id) {
    await wait();
    const c = db().channels.find((x) => x.id === id);
    c.isMember = false;
    c.memberIds = c.memberIds.filter((m) => m !== 'me');
    changed('channels');
  },
  async setChannelMuted(id, muted) {
    const c = db().channels.find((x) => x.id === id);
    c.muted = muted;
    changed('channels');
  },
  async createChannel(ws, { name, topic, isPrivate }) {
    await wait();
    const c = {
      id: uid('c'),
      ws,
      name: name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, ''),
      topic: topic || '',
      isMember: true,
      private: isPrivate,
      memberIds: ['me'],
      unread: 0,
    };
    db().channels.push(c);
    changed('channels');
    return toChannel(c);
  },

  async dms(ws) {
    await wait();
    return db()
      .dms.filter((d) => d.ws === ws)
      .map(toDm)
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  },
  async dm(id) {
    await wait(80);
    const d = db().dms.find((x) => x.id === id);
    if (!d) throw new Error('Conversation not found');
    return toDm(d);
  },
  async openDm(ws, userId) {
    await wait();
    let d = db().dms.find((x) => x.ws === ws && x.memberIds.includes(userId) && x.memberIds.length === 2);
    if (!d) {
      d = { id: uid('d'), ws, memberIds: ['me', userId], unread: 0 };
      db().dms.push(d);
      changed('dms');
    }
    return d.id;
  },

  async messages(conv) {
    await wait();
    const items = db()
      .messages.filter((m) => m.conv === conv.id && !m.parentId)
      .map(toMessage);
    return { items, hasMore: false };
  },
  async thread(conv, parentId) {
    await wait();
    const parent = db().messages.find((m) => m.id === parentId);
    const replies = (db().threadReplies[parentId] || []).map(toMessage);
    return { parent: parent ? toMessage(parent) : null, replies };
  },
  async sendMessage(conv, text, { parentId } = {}) {
    await wait(220);
    const m = { id: uid('m'), conv: conv.id, author: 'me', text, at: new Date().toISOString(), reactions: {} };
    if (parentId) {
      m.parentId = parentId;
      const list = (db().threadReplies[parentId] ||= []);
      list.push(m);
      const parent = db().messages.find((x) => x.id === parentId);
      if (parent) {
        parent.replyCount = list.length;
        parent.lastReplyAt = m.at;
        parent.replyIds = [...new Set([...(parent.replyIds || []), 'me'])];
      }
    } else {
      db().messages.push(m);
    }
    changed(`messages:${conv.id}`, 'dms', 'channels');
    return toMessage(m);
  },
  async editMessage(conv, id, text) {
    await wait();
    const m = db().messages.find((x) => x.id === id);
    if (m && m.author === 'me') {
      m.text = text;
      m.edited = true;
    }
    changed(`messages:${conv.id}`);
  },
  async deleteMessage(conv, id) {
    await wait();
    db().messages = db().messages.filter((x) => !(x.id === id && x.author === 'me'));
    changed(`messages:${conv.id}`);
  },
  async react(conv, id, emoji) {
    const m = db().messages.find((x) => x.id === id) || Object.values(db().threadReplies).flat().find((x) => x.id === id);
    if (!m) return;
    const users = new Set(m.reactions?.[emoji] || []);
    if (users.has('me')) users.delete('me');
    else users.add('me');
    m.reactions = { ...m.reactions, [emoji]: [...users] };
    if (!users.size) delete m.reactions[emoji];
    changed(`messages:${conv.id}`);
  },
  async togglePin(conv, id) {
    const m = db().messages.find((x) => x.id === id);
    if (m) m.pinned = !m.pinned;
    changed(`messages:${conv.id}`);
    return Boolean(m?.pinned);
  },
  async toggleSave(conv, id) {
    const m = db().messages.find((x) => x.id === id);
    if (m) m.saved = !m.saved;
    changed(`messages:${conv.id}`);
    return Boolean(m?.saved);
  },
  async markRead(conv) {
    const c = db().channels.find((x) => x.id === conv.id) || db().dms.find((x) => x.id === conv.id);
    if (c && (c.unread || c.mentions)) {
      c.unread = 0;
      c.mentions = 0;
      changed('channels', 'dms', 'workspaces');
    }
  },

  async tasks(ws) {
    await wait();
    return db().tasks.filter((t) => t.ws === ws && !t.trashed).map(toTask);
  },
  async task(id) {
    await wait(80);
    const t = db().tasks.find((x) => x.id === id);
    if (!t) throw new Error('Task not found');
    return toTask(t);
  },
  async createTask(ws, data) {
    await wait();
    const t = {
      id: uid('t'),
      ws,
      title: data.title,
      description: data.description || '',
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      due: data.due || null,
      assignees: data.assigneeIds?.length ? data.assigneeIds : ['me'],
      createdBy: 'me',
      project: data.project || null,
      updatedAt: new Date().toISOString(),
    };
    db().tasks.unshift(t);
    changed('tasks');
    return toTask(t);
  },
  async updateTask(id, patch) {
    await wait();
    const t = db().tasks.find((x) => x.id === id);
    if (!t) throw new Error('Task not found');
    if (patch.status && patch.status !== t.status && !TASK_TRANSITIONS[t.status]?.includes(patch.status)) {
      throw new Error(`A task can't move from ${t.status} to ${patch.status}.`);
    }
    if (patch.assigneeIds) {
      t.assignees = patch.assigneeIds;
      delete patch.assigneeIds;
    }
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
    changed('tasks', `task:${id}`);
    return toTask(t);
  },
  async trashTask(id) {
    await wait();
    const t = db().tasks.find((x) => x.id === id);
    if (t) t.trashed = true;
    changed('tasks');
  },

  async notes(ws) {
    await wait();
    return db()
      .notes.filter((n) => n.ws === ws)
      .map(toNote)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async note(id) {
    await wait(80);
    const n = db().notes.find((x) => x.id === id);
    if (!n) throw new Error('Note not found');
    return toNote(n);
  },
  async createNote(ws, { title, type, content }) {
    await wait();
    const n = { id: uid('n'), ws, title: title || 'Untitled', type: type || 'note', content: content || '', owner: 'me', updatedAt: new Date().toISOString() };
    db().notes.unshift(n);
    changed('notes');
    return toNote(n);
  },
  async updateNote(id, patch) {
    await wait(120);
    const n = db().notes.find((x) => x.id === id);
    if (!n) throw new Error('Note not found');
    Object.assign(n, patch, { updatedAt: new Date().toISOString() });
    changed('notes', `note:${id}`);
    return toNote(n);
  },
  async archiveNote(id, archived = true) {
    return this.updateNote(id, { archived });
  },

  async knowledge(ws) {
    await wait();
    return clone(db().knowledge.filter((k) => k.ws === ws));
  },
  async page(id) {
    await wait();
    const k = db().knowledge.find((x) => x.id === id);
    if (!k) throw new Error('Page not found');
    return {
      ...clone(k),
      content: `# ${k.title}\n\n${k.excerpt}\n\nThis page is part of the demo workspace. In a real workspace it holds your team's Markdown content, links to other pages and an AI summary.`,
    };
  },

  async files(ws) {
    await wait();
    return clone(db().files.filter((f) => f.ws === ws));
  },

  async notifications(ws) {
    await wait();
    return clone(db().notifications.filter((n) => n.ws === ws)).map(({ actor, ...n }) => ({ ...n, actorId: actor }));
  },
  async markNotificationRead(id) {
    const n = db().notifications.find((x) => x.id === id);
    if (n) n.read = true;
    changed('notifications');
  },
  async markAllNotificationsRead(ws) {
    db().notifications.filter((n) => n.ws === ws).forEach((n) => (n.read = true));
    changed('notifications');
  },

  async integrations() {
    await wait();
    return clone(db().integrations);
  },

  async sessions() {
    await wait();
    return clone(db().sessions);
  },
  async revokeSession(id) {
    await wait();
    db().sessions = db().sessions.filter((s) => s.id !== id || s.current);
    changed('sessions');
  },
  async revokeOtherSessions() {
    await wait();
    db().sessions = db().sessions.filter((s) => s.current);
    changed('sessions');
  },

  async aiAsk(ws, history, opts) {
    return answerDemoQuestion({ ws, history, db: db(), user, demo: demoAdapter, ...opts });
  },

  /** Message search (channels, DMs and thread replies) for the active workspace. */
  async searchMessages(ws, query) {
    await wait();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const convs = new Map([
      ...db().channels.filter((c) => c.ws === ws && c.isMember).map((c) => [c.id, { kind: 'channel', name: `#${c.name}` }]),
      ...db().dms.filter((d) => d.ws === ws).map((d) => [d.id, { kind: 'dm', name: user(d.memberIds.find((x) => x !== 'me')).name }]),
    ]);
    return [...db().messages, ...Object.values(db().threadReplies).flat()]
      .filter((m) => convs.has(m.conv) && m.text.toLowerCase().includes(q))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 40)
      .map((m) => ({ ...toMessage(m), convKind: convs.get(m.conv).kind, convName: convs.get(m.conv).name }));
  },

  async notificationPrefs(ws) {
    await wait(100);
    return { messages: true, threads: true, tasks: true, meetings: true, email: false, ...(db().notifPrefs?.[ws] || {}) };
  },
  async saveNotificationPrefs(ws, prefsPatch) {
    db().notifPrefs = { ...db().notifPrefs, [ws]: { ...(db().notifPrefs?.[ws] || {}), ...prefsPatch } };
    save();
  },
  async privacyPrefs() {
    await wait(100);
    return { readReceipts: true, typingIndicator: true, discoverable: true, ...(db().privacy || {}) };
  },
  async savePrivacyPrefs(patch) {
    db().privacy = { ...db().privacy, ...patch };
    save();
  },
  async securityStatus() {
    await wait(100);
    return { twoFactor: false, e2ee: 'ready', hasPassword: true };
  },

  async serverInfo() {
    return { reachable: true, label: 'Demo workspace (on this device)' };
  },

  /** Restore the sample data to its original state. */
  async resetDemo() {
    state = buildSeed();
    prefs.set(STORE_KEY, state);
    emit('data:changed', ['*']);
  },
};
