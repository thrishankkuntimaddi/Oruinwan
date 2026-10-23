// Live adapter: the Oruinwan server. Screens reach it through api() in ../session.js;
// every server shape is mapped into the app's own models here and nowhere else.
import {
  api, absolute, accessToken, configure, currentRefreshToken, endSession, loadTokens, refreshSession, saveTokens, serverUrl, settleRefresh, request, ApiError,
} from './http.js';
import {
  conversationKey, encryptText, forgetIdentity, prefetchWorkspaceKeys, protectIdentityWithPassword, readMessage, restoreIdentity, unlockIdentity, decryptPayload,
  unlockWithWrappedUmek,
} from './crypto.js';
import { challengeError, signinAdapter } from './adapter.signin.js';
import { connectRealtime, disconnectRealtime, joinWorkspace, realtimeConnected, realtimeSocket, resumeRealtime, socketEmit, socketRequest } from './realtime.js';
import { prefs } from '../../native/storage.js';
import { useE2ee } from '../e2ee.js';
import { normalizeServerUrl } from './server.js';
import { clientPlatform } from '../../native/index.js';
import { clearMessageIndex, forgetMessage, indexMessages, nameConversation, searchIndex, unloaded } from './messageIndex.js';
import { attachmentDoc, attachmentMessageBody, clearMediaCache, mapAttachment, mediaUrl, uploadFile } from './attachments.js';
import { fileIconKind } from '../../lib/files.js';
import { chatsAdapter, messageExtras } from './adapter.chats.js';
import { workAdapter } from './adapter.work.js';
import { roadmapAdapter } from './adapter.roadmap.js';
import { designAdapter } from './adapter.design.js';
import { callsAdapter } from './adapter.calls.js';
import { opsAdapter } from './adapter.ops.js';
import { backupAdapter } from './adapter.backup.js';
import { planAdapter } from './adapter.plan.js';
import { mapNotification } from './notificationLive.js';

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
    // The first-run tour (features/tour): only /auth/me carries preferences; unknown = undefined.
    tourDone: u.preferences?.tour ? u.preferences.tour.done === true : undefined,
  };
}

/** A 1:1 DM row. */
export function mapPersonDm(s, myId) {
  const user = mapUser(s.otherUser) || { id: s.otherUserId ? String(s.otherUserId) : null, name: 'Unknown', presence: 'offline' };
  return {
    id: idOf(s),
    isGroup: false,
    userId: user.id,
    user,
    participantIds: [myId, user.id].filter(Boolean),
    unread: s.unreadCount || 0,
    lastAt: s.lastMessageAt || null,
    lastText: null,
    agentId: s.isAgent ? s.agentId || 'default' : null,
  };
}

/** "Ben, Chen and 2 others" when a group has no name (the server's rule). */
export function groupTitle(name, people, myId) {
  if (name) return name;
  const names = (people || []).filter((p) => p.id !== myId).map((p) => p.name || 'Someone');
  if (names.length === 0) return 'Just you';
  if (names.length <= 3) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

/** A group DM row: `user` carries the group's title so screens that show one name keep working. */
export function mapGroupDm(s, myId) {
  const members = (s.members || []).map(mapUser).filter(Boolean);
  const name = s.displayName || groupTitle(s.name, members, myId);
  return {
    id: idOf(s),
    isGroup: true,
    name,
    groupName: s.name || null,
    createdBy: s.createdBy ? String(s.createdBy) : null,
    members,
    memberCount: s.memberCount || members.length,
    userId: null,
    user: { id: null, name, presence: null, avatarUrl: null },
    participantIds: members.map((m) => m.id),
    unread: s.unreadCount || 0,
    lastAt: s.lastMessageAt || null,
    lastText: null,
    agentId: null,
  };
}

/** GET /v2/dm/:id: the group with its people. */
export function mapGroupDetails(d, myId) {
  if (!d) return null;
  const members = (d.participants || []).map(mapUser).filter(Boolean);
  return {
    id: String(d.id),
    isGroup: Boolean(d.isGroup),
    groupName: d.name || null,
    name: d.displayName || groupTitle(d.name, members, myId),
    createdBy: d.createdBy || null,
    members,
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
  const mapped = toAppMessage(conv, m, text, state);
  indexMessages(conv, [mapped]);
  return mapped;
}

function toAppMessage(conv, m, text, state) {
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
    // Channel and DM attachments are on the message; thread replies keep them in the payload.
    attachments: (m.attachments?.length ? m.attachments : m.payload?.attachments || []).map(mapAttachment).filter(Boolean),
    ...messageExtras(m, me?.id), // polls, checklists, saved, edit history, thread state
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
    blockedReason: t.blockedReason || null,
    updatedAt: t.updatedAt,
    channelId: idOf(t.channel),
  };
}

const escHtml = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Notes written on the web are stored as a JSON list of blocks; the phone edits HTML. Turn blocks
 * into HTML here (text blocks already hold sanitised HTML). Plain HTML content passes through.
 */
export function noteContentToHtml(content) {
  let blocks = null;
  try { blocks = JSON.parse(content); } catch { /* HTML or plain text */ }
  if (!Array.isArray(blocks)) return content || '';
  const parse = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };
  return blocks.filter((b) => b && typeof b === 'object').map((b) => {
    switch (b.type) {
      case 'text': return b.content ? `<p>${b.content}</p>` : '';
      case 'heading': {
        const level = Math.min(Math.max(Number(b.meta?.level) || 1, 1), 3);
        return b.content ? `<h${level}>${escHtml(b.content)}</h${level}>` : '';
      }
      case 'checklist': {
        const items = parse(b.content, []);
        return Array.isArray(items) && items.length
          ? `<ul>${items.map((it) => `<li>${it.done ? '☑' : '☐'} ${escHtml(it.text)}</li>`).join('')}</ul>` : '';
      }
      case 'code': return b.content ? `<pre>${escHtml(b.content)}</pre>` : '';
      case 'callout': return b.content ? `<blockquote>${escHtml(b.content)}</blockquote>` : '';
      case 'toggle': return `<p><strong>${escHtml(b.meta?.title || 'Toggle')}</strong></p>${b.content ? `<p>${escHtml(b.content)}</p>` : ''}`;
      case 'divider': return '<hr>';
      case 'table': {
        const t = parse(b.content, {}) || {};
        const row = (cells, tag) => `<tr>${(cells || []).map((c) => `<${tag}>${escHtml(c)}</${tag}>`).join('')}</tr>`;
        return `<table>${row(t.headers, 'th')}${(t.rows || []).map((r) => row(r, 'td')).join('')}</table>`;
      }
      case 'image': return b.content ? `<p><img src="${escHtml(b.content)}" alt=""></p>` : '';
      default: return b.content && typeof b.content === 'string' ? `<p>${escHtml(b.content)}</p>` : '';
    }
  }).join('');
}

function mapNote(n) {
  return {
    id: idOf(n),
    title: n.title || 'Untitled',
    type: n.type || 'note',
    content: noteContentToHtml(n.content),
    pinned: Boolean(n.isPinned),
    archived: Boolean(n.isArchived),
    ownerId: idOf(n.owner),
    sharedWith: (n.sharedWith || []).map((s) => idOf(s.user || s)),
    visibility: n.isPublic ? 'workspace' : n.sharedWith?.length ? 'shared' : 'private',
    updatedAt: n.updatedAt,
  };
}

function mapPage(p) {
  return {
    id: idOf(p),
    parentId: idOf(p.parentId),
    title: p.title || 'Untitled page',
    icon: p.icon || '📄',
    updatedAt: p.updatedAt,
    excerpt: p.summary || p.excerpt || '',
    content: p.content ?? undefined,
    createdBy: idOf(p.createdBy),
  };
}

/** A one-line excerpt from Markdown, for page lists. */
function plainExcerpt(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s.*$/m, '')
    .replace(/[#>*_`~[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

// ---------------------------------------------------------------- AI

let streamUnavailable = false;

async function streamAi(body, { onToken, onTool, signal }) {
  if (streamUnavailable) throw new ApiError('stream unavailable', 0, null);
  // Streaming needs the browser's fetch (CapacitorHttp buffers whole responses), which in turn
  // needs the server to allow the app's origin. When it doesn't, the caller falls back.
  const webFetch = window.CapacitorWebFetch || window.fetch;
  const open = () =>
    webFetch(`${serverUrl()}/api/ai/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${accessToken()}`, 'x-client-platform': clientPlatform },
      body: JSON.stringify(body),
      signal,
    });
  let res = await open();
  if (res.status === 401) {
    // Access tokens last 15 minutes; refresh once and try again.
    await refreshSession();
    res = await open();
  }
  if (!res.ok || !res.body) {
    // Keep the server's refusal (e.g. a free-plan AI limit: 403 PLAN_LIMIT) instead of a bare status.
    let data = null;
    if (!res.ok) data = await Promise.resolve().then(() => res.json()).catch(() => null);
    throw new ApiError(data?.message || 'stream unavailable', res.status, data);
  }
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

/**
 * Shared end of Google sign-in and Google sign-up: the same two-factor, deactivation and session
 * handling as password sign-in. Keys unlock from the server's sealed copy; password-protected
 * keys ask for the password in Chats; accounts with no password yet choose one next.
 */
async function finishProviderSignIn(path, body, kind = 'google') {
  let data;
  try {
    data = await request('POST', path, { body, auth: false });
  } catch (err) {
    // Two-step verification (approve / authenticator / email) or the device limit: finished on
    // the challenge screen (features/auth/SignInChallenge.jsx).
    const challenge = challengeError(err, { kind });
    if (challenge) throw challenge;
    if (err.data?.requires2FA) {
      throw Object.assign(new Error(err.data.invalidCode ? "That code didn't work. Try the newest one." : 'Enter the code from your authenticator app.'), {
        code: '2FA_REQUIRED',
        invalidCode: Boolean(err.data.invalidCode),
      });
    }
    if (err.data?.requiresReactivation) throw new Error('This account is deactivated. Reactivate it from the web app first.');
    throw err;
  }
  // No account for this Google email yet: nothing is created until the person confirms.
  if (data?.needsSignup) {
    return { needsSignup: true, ticket: { signupToken: data.signupToken, email: data.email, name: data.name || '' } };
  }
  if (!data?.accessToken || !data?.refreshToken) throw new Error('The server did not return a mobile session. Update your Oruinwan server.');
  return completeSignIn(data, { kind });
}

/**
 * Any sign-in answer with a session → the signed-in user. Unlocks messages on this device:
 * with the typed password (which also moves an older password-protected key to automatic
 * unlock), with the key a QR sign-in wrapped for this device, or from the server's sealed copy.
 */
async function completeSignIn(data, ctx = {}) {
  await saveTokens({ access: data.accessToken, refresh: data.refreshToken });
  const user = mapUser(await api.get('/auth/me').catch(() => data.user));
  await afterSignIn(user);
  try {
    if (ctx.password) await unlockIdentity(user.id, ctx.password);
    else if (ctx.privateKey) await unlockWithWrappedUmek(user.id, ctx.privateKey, ctx.keys);
    else await unlockIdentity(user.id);
  } catch {
    /* status is shown in Chats */
  }
  return { user, requiresPasswordSetup: Boolean(data.requiresPasswordSetup) };
}

export const liveAdapter = {
  ...workAdapter, // planning, meetings, files, knowledge links, admin, security (adapter.work.js)
  ...roadmapAdapter, // roadmap items (adapter.roadmap.js)
  ...designAdapter, // design reviews (adapter.design.js)
  ...callsAdapter, // meeting recording, transcripts, captions, meeting AI (adapter.calls.js)
  ...opsAdapter, // automations, devices, notification settings, SSO (adapter.ops.js)
  ...backupAdapter, // Google Drive backup and restore (adapter.backup.js)
  ...planAdapter, // free-plan limits and usage (adapter.plan.js)
  kind: 'live',
  serverUrl,
  ...signinAdapter((data, ctx) => completeSignIn(data, ctx)), // challenges, QR sign-in, approvals (adapter.signin.js)
  ...chatsAdapter({ mapMessage, me: () => me, ws: () => currentWs, dm: (id) => dmCache.get(id) }),

  /**
   * Creates an account. Nothing is signed in: the server emails a link that must be opened
   * first. Server messages (email or username taken, weak password) come back as errors.
   */
  async signUp({ server, username, email, dob, password }) {
    configure(normalizeServerUrl(server));
    await request('POST', '/auth/signup', { body: { username, email, dob, password }, auth: false });
  },

  /** Sends a new verification link. The server answers the same whether or not the account exists. */
  async resendVerification({ server, email }) {
    configure(normalizeServerUrl(server));
    await request('POST', '/auth/resend-verification', { body: { email }, auth: false });
  },

  /** Throws { code: '2FA_REQUIRED' } when the account needs a one-time code. */
  async signIn({ server, email, password, otp }) {
    configure(normalizeServerUrl(server));
    let data;
    try {
      data = await request('POST', '/auth/login', { body: { email, password, ...(otp ? { otp } : {}) }, auth: false });
    } catch (err) {
      const challenge = challengeError(err, { kind: 'password', password });
      if (challenge) throw challenge;
      if (err.data?.requires2FA) {
        throw Object.assign(new Error('Enter the code from your authenticator app.'), { code: '2FA_REQUIRED', invalidCode: Boolean(err.data.invalidCode) });
      }
      if (err.data?.requiresReactivation) throw new Error('This account is deactivated. Reactivate it from the web app first.');
      if (err.data?.emailNotVerified) {
        throw Object.assign(new Error('Verify your email first. Open the link we sent you.'), { code: 'EMAIL_NOT_VERIFIED', email: err.data.email || email });
      }
      if (err.status === 400 || err.status === 401) throw new Error('That email and password do not match.');
      throw err;
    }
    if (!data?.accessToken || !data?.refreshToken) throw new Error('The server did not return a mobile session. Update your Oruinwan server.');
    // Unlock (or create) encryption keys with the password the user just typed.
    const { user } = await completeSignIn(data, { kind: 'password', password });
    return { user };
  },

  /**
   * Google sign-in with an access token from Google's sign-in window. For an email with no
   * account it returns { needsSignup, ticket } and signs nothing in.
   */
  async googleSignIn({ server, accessToken, credential, otp }) {
    configure(normalizeServerUrl(server));
    // accessToken: Google's pop-up in a browser. credential: an ID token from the Android app.
    const token = credential ? { credential } : { accessToken };
    return finishProviderSignIn('/auth/google-login', { ...token, ...(otp ? { otp } : {}) });
  },

  /**
   * Finishes company SSO (data/live/sso.js): trades the one-time code from oruinwan://sso and
   * the PKCE verifier for a session.
   */
  async ssoSignIn({ server, code, verifier }) {
    configure(normalizeServerUrl(server));
    return finishProviderSignIn('/auth/sso/app/exchange', { code, verifier }, 'sso');
  },

  /** Creates the account a Google sign-in asked to create (`ticket` from googleSignIn), then signs in. */
  async googleSignUp({ server, signupToken, username, dob }) {
    configure(normalizeServerUrl(server));
    return finishProviderSignIn('/auth/google-signup', { signupToken, username, dob });
  },

  /**
   * For accounts without a password (first Google sign-in): set one, so email sign-in works too.
   * Messages keep unlocking automatically (the server keeps the key sealed). The session stays.
   */
  async protectWithPassword(userId, password) {
    await request('POST', '/auth/oauth/set-password', { body: { password, refreshToken: currentRefreshToken() } });
    await protectIdentityWithPassword(userId, password);
  },

  /** Or keep signing in with Google only: the server holds the key, sealed. */
  async skipPassword(userId) {
    await request('POST', '/auth/oauth/skip-password', { body: {} });
    await unlockIdentity(userId);
  },

  async restore({ server }) {
    configure(server);
    if (!(await loadTokens())) throw new Error('Not signed in');
    let user;
    let offline = false;
    try {
      user = mapUser(await api.get('/auth/me'));
    } catch (err) {
      // Offline, or the server is restarting/overloaded: keep the session and use the cached
      // profile. Only an auth failure (handled by the refresh logic) signs the user out.
      const transient = err.network || err.status >= 500 || err.status === 429;
      if (!transient) throw err;
      user = prefs.get('live.user');
      offline = true;
      if (!user) throw err;
    }
    await afterSignIn(user);
    // Keys the server holds (accounts without a password) unlock again without asking if this
    // device lost its copy; password-protected keys stay locked until the password is typed.
    if (!(await restoreIdentity(user.id)) && !offline) await unlockIdentity(user.id).catch(() => {});
    return { user, offline };
  },

  async unlock(password) {
    return unlockIdentity(me.id, password);
  },

  async signOut() {
    // A refresh in flight would rotate the token after we read it, leaving that session valid.
    await settleRefresh();
    const tokensBefore = await loadTokens();
    const userId = me?.id || prefs.get('live.user')?.id;
    disconnectRealtime();
    try {
      if (tokensBefore?.refresh) await request('POST', '/auth/logout', { body: { refreshToken: tokensBefore.refresh }, auth: false });
    } finally {
      await forgetIdentity(userId);
      clearMessageIndex();
      clearMediaCache();
      await endSession();
      prefs.set('live.user', null);
      me = null;
    }
  },

  /**
   * Permanently erases the account on the server (DELETE /users/me). The server refuses
   * company-managed accounts and accounts under legal hold with a readable message. The
   * session ends here too, so the sign-out that follows makes no further calls as this user.
   */
  async deleteAccount() {
    await settleRefresh();
    await api.del('/users/me');
    disconnectRealtime();
    await endSession();
  },

  onResume() {
    resumeRealtime();
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
  /** The first-run tour was finished or skipped: saved on the account, so it shows once everywhere. */
  async markTourDone() {
    await api.put('/auth/me', { preferences: { tour: { done: true } } });
    if (me) {
      me = { ...me, tourDone: true };
      prefs.set('live.user', me);
    }
  },
  async setPresence(presence) {
    await api.patch('/users/status', { status: presence });
    return presence;
  },

  async workspaces() {
    const data = await api.get('/workspaces/my');
    return (data.workspaces || []).map(mapWorkspace);
  },
  /** Creates a workspace (with #general, #random and the project's channel). You are its owner. */
  async createWorkspace({ name, icon, color, project }) {
    const data = await api.post('/workspaces/create', { name, icon, color, ...(project ? { project } : {}) });
    const w = data.workspace;
    return { ...mapWorkspace({ ...w, role: 'owner', memberCount: 1 }), channels: (w.channels || []).map((c) => ({ id: idOf(c), name: c.name })) };
  },

  /** A team invite link anyone can use to join for 7 days. */
  async teamInviteLink(ws) {
    const data = await api.post(`/workspaces/${ws}/invite`, { inviteType: 'link', reusable: true, role: 'member' });
    return data.inviteLink;
  },

  /** What an invitation link is for, before joining: { workspaceName, invitedBy, memberCount, role, … }. */
  async inviteDetails(token) {
    const d = await api.get(`/workspaces/invite/${encodeURIComponent(token)}`);
    return {
      name: d.workspaceName,
      description: d.workspaceDescription || '',
      icon: d.workspaceIcon || null,
      color: d.workspaceColor || '#b8956a',
      invitedBy: d.invitedBy || null,
      memberCount: d.memberCount ?? null,
      role: d.role || 'member',
    };
  },

  /** Joins the workspace an invitation is for. Resolves with { id, name }. */
  async joinWithInvite(token) {
    try {
      const data = await api.post('/workspaces/join', { token });
      return { id: idOf(data.workspace), name: data.workspace?.name };
    } catch (err) {
      if (err.status === 400 && /already a member/i.test(err.message)) throw Object.assign(new Error(err.message), { code: 'ALREADY_MEMBER' });
      throw err;
    }
  },

  async inviteByEmail(ws, emails) {
    await api.post(`/workspaces/${ws}/invite`, { emails, inviteType: 'email' });
  },

  async members(ws) {
    const data = await api.get(`/workspaces/${ws}/members`);
    return (data.members || []).map(mapUser).sort((a, b) => a.name.localeCompare(b.name));
  },

  async channels(ws) {
    const data = await api.get(`/workspaces/${ws}/channels`);
    const list = (data.channels || []).map(mapChannel);
    for (const c of list) nameConversation(c.id, { kind: 'channel', name: `#${c.name}`, ws });
    return list;
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
        const dm = s.isGroup ? mapGroupDm(s, me?.id) : mapPersonDm(s, me?.id);
        if (s.lastMessagePreview?.ciphertext && useE2ee.getState().status === 'ready') {
          try {
            const key = await conversationKey({ kind: 'dm', id: dm.id });
            dm.lastText = await decryptPayload(key, s.lastMessagePreview);
          } catch {
            dm.lastText = null;
          }
        }
        dmCache.set(dm.id, dm);
        nameConversation(dm.id, { kind: 'dm', name: dm.user.name, ws });
        return dm;
      }),
    );
    return list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  },
  // Group DMs (3+ people). The server adds me to the group I create.
  async createGroupDm(ws, memberIds, name) {
    const data = await api.post('/v2/dm/group', { workspaceId: ws, memberIds, ...(name?.trim() ? { name: name.trim() } : {}) });
    return mapGroupDetails(data.dm, me?.id);
  },
  async dmDetails(id) {
    const data = await api.get(`/v2/dm/${id}`);
    return mapGroupDetails(data.dm, me?.id);
  },
  async renameGroupDm(id, name) {
    const data = await api.patch(`/v2/dm/${id}`, { name });
    return mapGroupDetails(data.dm, me?.id);
  },
  async addGroupDmMembers(id, userIds) {
    const data = await api.post(`/v2/dm/${id}/members`, { userIds });
    return mapGroupDetails(data.dm, me?.id);
  },
  async removeGroupDmMember(id, userId) {
    await api.del(`/v2/dm/${id}/members/${userId}`);
  },
  async leaveGroupDm(id) {
    await api.del(`/v2/dm/${id}/members/me`);
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
    indexMessages(conv, [], { complete: true });
    return { items: items.filter((m) => !m.parentId), hasMore: Boolean(data.hasMore) };
  },
  async thread(conv, parentId) {
    const data = await api.get(`/v2/messages/thread/${parentId}`);
    return {
      parent: data.parent ? await mapMessage(conv, data.parent) : null,
      replies: chronological(await mapMessages(conv, data.replies)),
    };
  },
  async sendMessage(conv, text, { parentId, clientTempId, mentionText } = {}) {
    const dm = dmCache.get(conv.id);
    const key = await conversationKey(conv, {
      workspaceId: currentWs,
      participantIds: dm ? dm.participantIds : undefined,
      create: conv.kind === 'dm',
    }).catch((err) => {
      throw new Error(useE2ee.getState().status !== 'ready' ? 'Unlock your messages first (Chats → Unlock).' : err.message);
    });
    const body = { ...(await encryptText(key, text)), clientTempId, clientMessageId: clientTempId, ...(mentionText ? { mentionText } : {}) }; // server dedupes on clientMessageId
    let data;
    if (parentId) data = await api.post(`/v2/messages/thread/${parentId}`, body);
    else if (conv.kind === 'channel') data = await api.post('/v2/messages/channel', { ...body, channelId: conv.id });
    else data = await api.post('/v2/messages/direct', { ...body, dmSessionId: conv.id });
    const saved = data.message || data.reply || data;
    return mapMessage(conv, saved);
  },
  /** Uploads a file for this conversation (not yet sent). Resolves with the attachment. */
  async uploadAttachment(conv, file, { onProgress, signal } = {}) {
    return uploadFile(file, { conversationId: conv.id, conversationType: conv.kind === 'channel' ? 'channel' : 'dm', onProgress, signal });
  },

  /**
   * Sends an uploaded attachment as its own message, like the web client. Thread replies must
   * carry encrypted text, so there the file's name is the (encrypted) caption.
   */
  async sendAttachment(conv, attachment, { parentId, clientTempId } = {}) {
    let data;
    if (parentId) {
      const key = await conversationKey(conv).catch(() => {
        throw new Error('Unlock your messages first (Chats → Unlock).');
      });
      data = await api.post(`/v2/messages/thread/${parentId}`, { ...(await encryptText(key, attachment.name)), attachments: [attachmentDoc(attachment)], clientTempId });
    } else {
      data = await api.post(conv.kind === 'channel' ? '/v2/messages/channel' : '/v2/messages/direct', attachmentMessageBody(conv, attachment, { workspaceId: currentWs, clientTempId }));
    }
    const mapped = await mapMessage(conv, data.message || data.reply || data);
    return mapped.attachments.length ? mapped : { ...mapped, attachments: [attachment] };
  },

  /** A URL the app can load the file from (signed for a few minutes). */
  async mediaUrl(attachment, opts) {
    return mediaUrl(attachment, opts);
  },

  async editMessage(conv, id, text) {
    const key = await conversationKey(conv);
    const { ciphertext, messageIv } = await encryptText(key, text);
    await api.patch(`/v2/messages/${id}`, { ciphertext, messageIv });
  },
  async deleteMessage(conv, id) {
    await api.del(`/v2/messages/${id}`, { scope: 'everyone' });
    forgetMessage(conv.id, id);
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
  async createNote(ws, { title, type, content, templateId }) {
    // templateId: the template it was made from ('meeting', 'projectspec', …); the free plan counts
    // notes per template. None for a blank note.
    const data = await api.post('/v2/notes', { title: title || 'Untitled', type, content, workspaceId: ws, ...(templateId && templateId !== 'blank' ? { templateId } : {}) });
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

  /** Every page in the workspace (sub-pages carry their parentId), newest first. */
  async knowledge(ws) {
    const data = await api.get('/v2/knowledge/pages', { workspaceId: ws });
    return (data.pages || []).map((p) => {
      const { content, ...page } = mapPage(p);
      return { ...page, excerpt: page.excerpt || plainExcerpt(content) };
    });
  },
  async page(id) {
    const data = await api.get(`/v2/knowledge/pages/${id}`);
    const p = mapPage(data.page || data);
    return { ...p, content: p.content || '' };
  },
  /** A new page (Markdown, like the web). */
  async createPage(ws, { title, content = '', icon, parentId } = {}) {
    const data = await api.post('/v2/knowledge/pages', { workspaceId: ws, title: title?.trim() || 'Untitled page', content, ...(icon ? { icon } : {}), ...(parentId ? { parentId } : {}) });
    const p = mapPage(data.page || data);
    return { ...p, content: p.content || '' };
  },
  /** patch: { title, content, icon } */
  async updatePage(id, patch) {
    const body = {};
    for (const k of ['title', 'content', 'icon']) if (k in patch) body[k] = patch[k];
    const data = await api.put(`/v2/knowledge/pages/${id}`, body);
    const p = mapPage(data.page || data);
    return { ...p, content: p.content || '' };
  },
  async deletePage(id) {
    await api.del(`/v2/knowledge/pages/${id}`);
  },

  async files(ws) {
    const data = await api.get('/v2/files', { workspaceId: ws, folderId: 'root' });
    return (data.files || []).map((f) => ({
      id: idOf(f),
      name: f.name || f.originalName || 'File',
      size: f.size,
      mimeType: f.mimeType || '',
      kind: fileIconKind(f),
      owner: idOf(f.createdBy || f.uploadedBy || f.owner),
      at: f.createdAt,
      // Opened through the same signed links as attachments.
      url: f.url || null,
      gcsPath: f.gcsPath || null,
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
    return {
      messages: p.message !== false, threads: p.threadReply !== false, tasks: p.task !== false, meetings: p.meeting !== false,
      aiSuggestions: p.aiSuggestions !== false, email: Boolean(p.email),
    };
  },
  async saveNotificationPrefs(ws, patch) {
    const map = { messages: 'message', threads: 'threadReply', tasks: 'task', meetings: 'meeting', aiSuggestions: 'aiSuggestions', email: 'email' };
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

  /** Agents installed in this workspace (Oruinwan AI is always there). */
  async agents(ws) {
    const data = await api.get('/agents', { workspaceId: ws });
    return (data.agents || [])
      .filter((a) => a.installed)
      .map((a) => ({ id: a.id, name: a.name, maker: a.maker, tagline: a.tagline, icon: absolute(a.icon), mention: a.mention }));
  },

  /**
   * Every agent and tool with how it's connected for you: installed for the workspace, connected
   * just for you (your own key or account), and which one answers you. Plus the workspace policy.
   */
  async agentDirectory(ws) {
    const data = await api.get('/agents', { workspaceId: ws });
    const own = (c) => (c ? { method: c.method, model: c.model || null, login: c.account?.login || null, connectedAt: c.connectedAt || null } : null);
    return {
      policy: data.policy || { canConnectOwn: false, membersMayConnect: false },
      canManage: Boolean(data.canManage),
      agents: (data.agents || []).map((a) => ({
        id: a.id, name: a.name, maker: a.maker, tagline: a.tagline, icon: absolute(a.icon), mention: a.mention, builtIn: Boolean(a.builtIn),
        installed: Boolean(a.installed), installedForWorkspace: Boolean(a.installedForWorkspace), inUse: a.inUse || null, model: a.model || null,
        connectedForYou: own(a.connectedForYou),
        authorization: a.authorization ? { label: a.authorization.label, keysUrl: a.authorization.keysUrl, keyHint: a.authorization.keyHint } : null,
      })),
      tools: (data.tools || []).filter((t) => t.personal).map((t) => ({ id: t.id, name: t.name, maker: t.maker, tagline: t.tagline, actsAs: t.personal.actsAs, connectedForYou: own(t.connectedForYou) })),
    };
  },

  /** Connect your own key for an agent (checked live with the provider before it's saved). */
  async connectOwnAgent(ws, agentId, apiKey, model) {
    await api.post(`/connections/agents/${agentId}`, { workspaceId: ws, apiKey, ...(model ? { model } : {}) });
  },

  /** Remove your own connection ('anthropic', 'github', …). */
  async disconnectOwn(ws, provider) {
    await api.del(`/connections/${provider}?workspaceId=${encodeURIComponent(ws)}`);
  },

  /** The conversation with an agent (created on first use). Returns the DM id. */
  async openAgentDm(ws, agentId) {
    const data = await api.post(`/agents/${agentId}/dm`, { workspaceId: ws });
    return String(data.dmSessionId);
  },

  /** Oruinwan AI plus each model the workspace connected (Claude, ChatGPT, Gemini, Grok). */
  async assistants(ws) {
    const data = await api.get('/ai/assistants', { workspaceId: ws });
    return (data.assistants || []).map((a) => ({ id: a.id, name: a.name, mention: a.mention, model: a.model || null }));
  },

  async aiAsk(ws, history, { onToken, onTool, signal, assistant } = {}) {
    const last = history[history.length - 1]?.content || '';
    const body = { message: last, history: history.slice(0, -1).slice(-12), workspaceId: ws, ...(assistant && assistant !== 'default' ? { assistant } : {}) };
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

  /**
   * Asks Oruinwan AI to answer in this conversation (after a message that mentions @ai).
   * The answer streams over the socket ('ai:reply') and is then saved as a normal message.
   */
  async askAiInConversation(conv, { prompt, triggerMessageId, parentId = null, messages = [], conversationName, assistant }) {
    const data = await api.post('/ai/reply', {
      workspaceId: currentWs,
      conversationId: conv.id,
      conversationType: conv.kind === 'channel' ? 'channel' : 'dm',
      parentId,
      triggerMessageId,
      conversationName,
      prompt,
      messages: messages.slice(-40),
      ...(assistant && assistant !== 'default' ? { assistant } : {}),
    });
    return data?.replyId || null;
  },

  /**
   * Message search. Bodies are end-to-end encrypted, so this searches on the phone: the
   * messages already decrypted here, plus the latest messages of conversations not fetched
   * lately (a few at a time, at most 30 conversations per search).
   */
  /** Whether this server can send push notifications: { android, ios }. */
  async pushStatus() {
    return api.get('/push/status');
  },
  async registerPushToken(token, platform) {
    await api.post('/push/register', { token, platform });
  },
  async unregisterPushToken(token) {
    await api.post('/push/unregister', { token });
  },

  // ---- Huddles (voice calls). Signalling runs over the socket; see features/huddles/huddle.js.
  huddles: {
    emit: socketEmit,
    request: socketRequest,
    connected: realtimeConnected,
    // This connection's id: the server's huddle:self_active names the socket my call runs on.
    socketId: () => realtimeSocket()?.id || null,
    async iceServers() {
      return api.get('/v2/huddles/ice-servers');
    },
    async meetings(ws) {
      const data = await api.get('/scheduled-meetings', { workspaceId: ws, limit: 20 });
      return data.meetings || [];
    },
    async joinMeeting(id) {
      const data = await api.post(`/v2/meetings/${id}/join`, {});
      return data.meeting || null;
    },
  },

  async searchMessages(ws, query) {
    if (useE2ee.getState().status !== 'ready') return [];
    const [channels, dms] = await Promise.all([
      liveAdapter.channels(ws).catch(() => []),
      liveAdapter.dms(ws).catch(() => []),
    ]);
    const convs = [
      ...channels.filter((c) => c.isMember).map((c) => ({ kind: 'channel', id: c.id, ws, lastAt: c.lastAt })),
      ...dms.map((d) => ({ kind: 'dm', id: d.id, ws, lastAt: d.lastAt })),
    ];
    const todo = unloaded(ws, convs)
      .sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')))
      .slice(0, 30);
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(todo.slice(i, i + 4).map((c) => liveAdapter.messages(c).catch(() => null)));
    }
    return searchIndex(ws, query);
  },
};
