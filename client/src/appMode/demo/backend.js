// The in-app backend behind "Explore the demo" (desktop and tablet apps). It answers the web
// client's API calls from the sample workspace in seed.js, in the shapes the Oruinwan server
// returns, so every screen is the real web client. What you do in the demo (messages,
// reactions, tasks, notes, channels) lives in memory until you leave it.
import { buildDemoSeed, demoId, ME, WORKSPACE_ID } from './seed';
import { encryptForDemo } from './crypto';
import { DEMO_REFRESH_TOKEN, demoAccessToken } from './session';

let db = null;
let seq = 0;
const nextId = (group) => demoId(group, 900000 + (seq += 1));
const nowIso = () => new Date().toISOString();

function store() {
  if (!db) {
    const seed = buildDemoSeed();
    db = {
      ...seed,
      messages: [...seed.messages, ...seed.replies].map((m) => ({ ...m })),
      channels: seed.channels.map((c) => ({ ...c, members: c.members.map((k) => seed.user[k].id) })),
      dms: seed.dms.map((d) => ({ ...d, participants: [ME, seed.user[d.other].id] })),
    };
  }
  return db;
}

// ── Shapes ────────────────────────────────────────────────────────────────────

const person = (id) => store().people.find((p) => p.id === String(id)) || store().people[0];
const userRef = (id) => {
  const p = person(id);
  return { _id: p.id, username: p.username, email: p.email, profilePicture: null, profile: { name: p.name } };
};
const presence = (p) => (p.status === 'offline' ? 'offline' : p.status);

function me() {
  const p = person(ME);
  return {
    id: p.id, _id: p.id, sub: p.id, username: p.username, email: p.email, personalEmail: null, phone: null, phoneCode: '+1',
    userType: 'personal', companyId: null, companyRole: 'member', jobTitle: p.jobTitle, roles: ['user'], verified: true,
    accountStatus: 'active', isActive: true, authProvider: 'local', twoFactorEnabled: false, profilePicture: null,
    profile: { name: p.name, bio: 'Exploring the Oruinwan demo' }, preferences: {}, userStatus: 'active', status: 'online',
    isTemporaryPassword: false, passwordInitialized: true, createdAt: store().workspace.createdAt,
  };
}

const member = (p) => ({
  _id: p.id, id: p.id, name: p.name, username: p.username, email: p.email, phone: null, profilePicture: null, userStatus: 'active',
  profile: { name: p.name }, jobTitle: p.jobTitle, isOnline: p.status !== 'offline', status: presence(p),
  lastSeen: new Date(store().now - 3_600_000).toISOString(), role: p.role, membershipStatus: 'active',
  joinedAt: store().workspace.createdAt, isCurrentUser: p.id === ME,
});

function workspaceSummary() {
  const w = store().workspace;
  return {
    id: w.id, _id: w.id, name: w.name, description: w.description, icon: w.icon, color: w.color, rules: '', settings: {}, type: 'team',
    role: 'owner', membershipStatus: 'active', memberCount: store().people.length, isPersonal: false, ownerName: person(ME).username, isOwner: true,
  };
}

const lastMessageIn = (where) => store().messages.filter((m) => !m.parentId && where(m)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop() || null;

function channelOut(c) {
  const last = lastMessageIn((m) => m.channelId === c.id);
  const isMember = c.members.includes(ME);
  return {
    _id: c.id, id: c.id, workspace: WORKSPACE_ID, company: null, name: c.name, description: c.description, topic: c.description,
    isPrivate: Boolean(c.isPrivate), isDiscoverable: !c.isPrivate, isDefault: Boolean(c.isDefault), isPublic: !c.isPrivate, isArchived: false,
    createdBy: userRef(store().user.priya.id), creatorName: store().user.priya.username,
    members: c.members.map((u) => ({ user: u, joinedAt: c.createdAt, lastSeenMessageId: null })),
    admins: [ME], postingPolicy: c.postingPolicy || 'everyone', broadcastMentions: 'everyone',
    lastMessageAt: last?.createdAt || c.createdAt, messageCount: store().messages.filter((m) => m.channelId === c.id).length,
    pinnedMessages: [], mutedBy: [], tabs: [], createdAt: c.createdAt, updatedAt: last?.createdAt || c.createdAt,
    isMember, unreadCount: isMember ? c.unread || 0 : 0,
  };
}

function channelDetails(c) {
  const members = c.members.map((u) => ({ user: userRef(u), joinedAt: c.createdAt }));
  return {
    id: c.id, _id: c.id, name: c.name, description: c.description, isPrivate: Boolean(c.isPrivate), isDefault: Boolean(c.isDefault),
    createdBy: userRef(ME), createdAt: c.createdAt, creatorName: person(ME).username, memberCount: c.members.length,
    admins: [userRef(ME)], broadcastMentions: 'everyone', postingPolicy: c.postingPolicy || 'everyone', members,
  };
}

async function messageOut(m) {
  const type = m.channelId ? 'channel' : 'dm';
  const conv = m.channelId || m.dmId;
  if (!m.ciphertext) {
    // Thread replies use the conversation key too (only isThreadEncrypted messages derive one).
    const enc = await encryptForDemo(m.text, conv, type);
    m.ciphertext = enc.ciphertext;
    m.messageIv = enc.messageIv;
  }
  const replies = store().messages.filter((r) => r.parentId === m.id);
  return {
    _id: m.id, company: null, workspace: WORKSPACE_ID, channel: m.channelId, dm: m.dmId, platformSession: null,
    sender: userRef(m.author), type: 'message', systemEvent: null, systemData: null,
    payload: { ciphertext: m.ciphertext, messageIv: m.messageIv, isEncrypted: true },
    text: '', attachments: [], poll: { allowMultiple: false, anonymous: false, isActive: true, totalVotes: 0, options: [] }, meeting: { participants: [] },
    parentId: m.parentId || null, replyCount: replies.length, lastReplyAt: replies.length ? replies[replies.length - 1].createdAt : null,
    quotedMessageId: null, readBy: [], mentions: [], followers: [], resolvedThreadAt: null, linkedTaskId: null,
    isPinned: false, pinnedBy: null, pinnedAt: null, deletedAt: null, isDeletedUniversally: false, hiddenFor: [], bookmarkedBy: [],
    editedAt: null, isDeleted: false, version: 1, reactions: m.reactions || [], checklist: [], editHistory: [],
    createdAt: m.createdAt, updatedAt: m.createdAt, __v: 0,
  };
}

const conversationMessages = (where) => store().messages
  .filter((m) => !m.parentId && where(m))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

function dmSession(d) {
  const other = d.participants.find((p) => p !== ME) || ME;
  const last = lastMessageIn((m) => m.dmId === d.id);
  const p = person(other);
  return {
    id: d.id, _id: d.id,
    otherUser: { _id: p.id, username: p.username, email: p.email, profilePicture: null, isOnline: p.status !== 'offline', userStatus: 'active' },
    otherUserId: p.id, lastMessage: last ? '🔒 Encrypted message' : null,
    lastMessagePreview: last?.ciphertext ? { ciphertext: last.ciphertext, messageIv: last.messageIv } : null,
    lastMessageId: last?.id || null, lastMessageAt: last?.createdAt || null, unreadCount: d.unread || 0,
  };
}

const taskOut = (t) => ({
  _id: t.id, id: t.id, company: null, workspace: WORKSPACE_ID, project: null, issueKey: t.issueKey, type: 'task', taskType: 'workspace',
  parentTask: null, title: t.title, description: t.description || '', createdBy: userRef(t.createdBy), visibility: 'workspace',
  channel: null, status: t.status, blockedReason: t.blockedReason || null, dueDate: t.dueDate || null, startDate: null,
  priority: t.priority, completedAt: t.status === 'done' ? t.updatedAt : null, completionNote: '', source: 'manual',
  tags: t.tags || [], labels: [], externalLinks: [], attachments: [], deleted: Boolean(t.deleted), deletedAt: null,
  timeTracking: { sessions: [], totalTime: 0 }, recurring: { nextDue: null, pattern: null, interval: 1, isRecurring: false },
  createdAt: t.createdAt, updatedAt: t.updatedAt, assignedTo: t.assignees.map(userRef), watchers: [], linkedIssues: [], dependencies: [], subtasks: [],
});

const noteOut = (n) => ({
  _id: n.id, title: n.title, content: n.content, type: n.type || 'note', owner: userRef(n.ownerId || store().user[n.owner]?.id || ME),
  workspace: WORKSPACE_ID, sharedWith: [], isPublic: false, allowEditing: true, isPinned: Boolean(n.isPinned), isArchived: false,
  attachments: [], tags: n.tags || [], createdAt: n.createdAt, updatedAt: n.updatedAt,
});

function activity() {
  const items = [];
  for (const c of store().channels) {
    if (!c.unread || !c.members.includes(ME)) continue;
    const last = lastMessageIn((m) => m.channelId === c.id);
    if (!last) continue;
    items.push({
      type: 'channel', id: c.id, name: c.name, isPrivate: Boolean(c.isPrivate), unread: c.unread, mentioned: c.key === 'engineering', muted: false,
      lastMessage: { id: last.id, senderId: last.author, type: 'message', kindLabel: null, preview: last.ciphertext ? { ciphertext: last.ciphertext, messageIv: last.messageIv } : null, createdAt: last.createdAt, senderUsername: person(last.author).username, senderAvatar: null },
    });
  }
  for (const d of store().dms) {
    if (!d.unread) continue;
    const last = lastMessageIn((m) => m.dmId === d.id);
    if (!last) continue;
    const p = person(d.participants.find((x) => x !== ME));
    items.push({
      type: 'dm', id: d.id, unread: d.unread, mentioned: false, muted: false,
      otherUser: { id: p.id, username: p.username, profilePicture: null, status: presence(p) },
      lastMessage: { id: last.id, senderId: last.author, type: 'message', kindLabel: null, preview: last.ciphertext ? { ciphertext: last.ciphertext, messageIv: last.messageIv } : null, createdAt: last.createdAt },
    });
  }
  return items.sort((a, b) => (b.lastMessage.createdAt || '').localeCompare(a.lastMessage.createdAt || ''));
}

// ── Oruinwan AI, simulated from the sample workspace ─────────────────────────

const STATUS = { backlog: 'backlog', todo: 'to do', in_progress: 'in progress', review: 'in review', blocked: 'blocked', done: 'done', cancelled: 'cancelled' };

function dueText(iso) {
  if (!iso) return '';
  const days = Math.round((new Date(iso) - Date.now()) / 86_400_000);
  if (days < 0) return ', overdue';
  if (days === 0) return ', due today';
  if (days === 1) return ', due tomorrow';
  return `, due in ${days} days`;
}

function demoAnswer(question) {
  const q = String(question || '').toLowerCase();
  const s = store();
  if (/plate|my tasks|to do|todo|due|focus|week/.test(q)) {
    const mine = s.tasks.filter((t) => !t.deleted && t.assignees.includes(ME) && !['done', 'cancelled'].includes(t.status))
      .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
    if (!mine.length) return 'Your list is clear: nothing open is assigned to you.';
    return `You have **${mine.length} open tasks**:\n\n${mine.slice(0, 5).map((t) => `- **${t.title}** (${STATUS[t.status] || t.status}${dueText(t.dueDate)})`).join('\n')}\n\nI'd start with the first one; it's the most urgent.`;
  }
  if (/summar|catch me up|unread|what did i miss|happening/.test(q)) {
    const unread = s.channels.filter((c) => c.unread && c.members.includes(ME));
    if (!unread.length) return "You're all caught up. No unread channels.";
    const lines = unread.map((c) => {
      const recent = s.messages.filter((m) => m.channelId === c.id && !m.parentId && m.text).slice(-2)
        .map((m) => `${person(m.author).username}: ${m.text.replace(/```[\s\S]*?```/g, '[code]').slice(0, 90)}`).join(' · ');
      return `- **#${c.name}** (${c.unread} new): ${recent}`;
    });
    return `Here's what's new:\n\n${lines.join('\n')}\n\nThe one that needs you: Aisha asked you to sign off the release checklist in #engineering.`;
  }
  if (/create|add|new/.test(q) && /task/.test(q)) {
    const raw = String(question).replace(/^(please\s+)?(create|add|make)( a| new)? task( to| for| called)?:?\s*/i, '').trim() || 'Follow up from AI chat';
    const title = raw.charAt(0).toUpperCase() + raw.slice(1);
    s.tasks.unshift({ id: nextId('f2'), issueKey: `OL-${s.tasks.length + 1}`, title, description: 'Created by Oruinwan AI', status: 'todo', priority: 'medium', dueDate: null, tags: [], createdBy: ME, assignees: [ME], createdAt: nowIso(), updatedAt: nowIso() });
    return `Done. I created **${title}** and assigned it to you. You'll find it in Tasks.`;
  }
  if (/draft|write|reply|announce|message/.test(q)) {
    return "Here's a draft you can paste:\n\n> Hi team: Oruinwan 1.2 is out. The desktop apps and tablets now run the full workspace, and iPhone and iPad are coming through TestFlight. Grab it from the Download page and post anything odd in #mobile-launch. Thanks for all the care on this one!\n\nWant it shorter or more formal?";
  }
  if (/note|meeting/.test(q)) {
    return `Your most recent notes are ${s.notes.filter((n) => !n.deleted).slice(0, 3).map((n) => `**${n.title}**`).join(', ')}. The release checklist still has unticked items.`;
  }
  if (/hello|\bhi\b|hey/.test(q)) return "Hi! I can summarise channels, list what's on your plate, draft messages and create tasks. What would you like to do?";
  return "I'm the demo version of Oruinwan AI, so these answers are simulated from the sample workspace. Try:\n\n- *What's on my plate this week?*\n- *Catch me up on unread channels*\n- *Create a task to review the onboarding copy*\n- *Draft a message announcing the release*\n\nConnected to your own server, Oruinwan AI uses your workspace's model and tools.";
}

/** The answer as server-sent events, word by word like the real assistant (services/aiService.js). */
function aiStream(text) {
  const encoder = new TextEncoder();
  const words = text.match(/\S+\s*/g) || [text];
  return new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ t: w })}\n\n`));
        await new Promise((r) => setTimeout(r, 18 + Math.random() * 30));
      }
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ text, provider: 'demo', sources: [] })}\n\n`));
      controller.close();
    },
  });
}

const lastQuestion = (body) => body.message || body.instruction || body.question || body.text || '';

// ── Handlers ──────────────────────────────────────────────────────────────────

const ok = (data, status = 200) => ({ status, data });
const notFound = (message = 'Not found') => ({ status: 404, data: { message } });
const channelById = (id) => store().channels.find((c) => c.id === id);
const dmById = (id) => store().dms.find((d) => d.id === id);

async function postMessage({ channelId = null, dmId = null, parentId = null, body }) {
  const m = {
    id: nextId('e1'), channelId, dmId, parentId, author: ME, text: null,
    ciphertext: body.ciphertext, messageIv: body.messageIv, createdAt: nowIso(), reactions: [],
  };
  store().messages.push(m);
  return messageOut(m);
}

const ROUTES = [
  ['GET', /^\/api\/health$/, () => ok({ status: 'healthy', demo: true })],
  ['GET', /^\/api\/auth\/me$/, () => ok(me())],
  ['GET', /^\/api\/auth\/me\/preferences\/notifications$/, () => ok({ emailDigest: false, marketingEmails: false, desktopPush: true, sound: true, mentionsOnly: false, dmNotifications: true })],
  ['POST', /^\/api\/auth\/refresh$/, () => ok({ accessToken: demoAccessToken(), refreshToken: DEMO_REFRESH_TOKEN })],
  ['GET', /^\/api\/flags$/, () => ok({ success: true, flags: { billing: false, sso: false, integrations: false, community: false } })],

  ['GET', /^\/api\/workspaces\/my$/, () => ok({ workspaces: [workspaceSummary()] })],
  ['GET', /^\/api\/workspaces\/[^/]+\/features$/, () => ok({ featureToggles: { tasks: true, notes: true, polls: true, ai: true, huddles: true, fileUploads: true, reactions: true, threads: true, bookmarks: true, reminders: true } })],
  ['GET', /^\/api\/workspaces\/[^/]+\/(members|all-members)$/, () => ok({ members: store().people.map(member) })],
  ['GET', /^\/api\/workspaces\/[^/]+\/channels$/, () => ok({ channels: store().channels.map(channelOut) })],
  ['POST', /^\/api\/workspaces\/[^/]+\/channels$/, (body) => {
    const c = { id: nextId('c1'), key: body.name, name: String(body.name || 'new-channel'), description: body.description || '', isPrivate: Boolean(body.isPrivate), members: [ME, ...(body.members || [])], createdAt: nowIso(), unread: 0 };
    store().channels.push(c);
    return ok({ message: 'Channel created successfully', channel: channelOut(c) }, 201);
  }],
  ['GET', /^\/api\/channels\/my$/, () => ok({ channels: store().channels.filter((c) => c.members.includes(ME)).map(channelOut) })],
  ['GET', /^\/api\/channels\/([^/]+)\/details$/, (_, [id]) => (channelById(id) ? ok({ channel: channelDetails(channelById(id)) }) : notFound('Channel not found'))],
  ['GET', /^\/api\/channels\/([^/]+)\/mute$/, (_, [id]) => ok({ isMuted: false, postingPolicy: channelById(id)?.postingPolicy || 'everyone', broadcastMentions: 'everyone', canManage: true })],
  ['GET', /^\/api\/channels\/([^/]+)\/tabs$/, () => ok({ tabs: [] })],

  ['GET', /^\/api\/v2\/messages\/channel\/([^/]+)$/, async (_, [id]) => {
    const c = channelById(id);
    if (!c) return notFound('Channel not found');
    c.unread = 0;
    const messages = await Promise.all(conversationMessages((m) => m.channelId === id).map(messageOut));
    return ok({ messages, hasMore: false, userJoinedAt: c.createdAt, channelMembers: c.members.map((u) => ({ userId: u, joinedAt: c.createdAt, username: person(u).username })) });
  }],
  ['POST', /^\/api\/v2\/messages\/channel$/, async (body) => ok({ message: await postMessage({ channelId: body.channelId, parentId: body.replyTo || null, body }) }, 201)],
  ['GET', /^\/api\/v2\/messages\/workspace\/[^/]+\/dms$/, async () => {
    await Promise.all(store().dms.map((d) => { const last = lastMessageIn((m) => m.dmId === d.id); return last ? messageOut(last) : null; }));
    return ok({ sessions: store().dms.map(dmSession) });
  }],
  ['GET', /^\/api\/v2\/messages\/workspace\/[^/]+\/dm\/resolve\/([^/]+)$/, (_, [userId]) => {
    let d = store().dms.find((x) => x.participants.includes(userId) && x.participants.includes(ME) && (userId !== ME || x.participants.every((p) => p === ME)));
    if (!d) {
      d = { id: nextId('d1'), key: userId, participants: [ME, userId], unread: 0 };
      store().dms.push(d);
    }
    return ok({ success: true, dmSessionId: d.id, otherUserId: userId, workspaceId: WORKSPACE_ID, participants: d.participants });
  }],
  ['GET', /^\/api\/v2\/messages\/workspace\/[^/]+\/dm\/([^/]+)$/, async (_, [id]) => {
    const d = dmById(id);
    if (!d) return notFound('Conversation not found');
    d.unread = 0;
    const messages = await Promise.all(conversationMessages((m) => m.dmId === id).map(messageOut));
    return ok({ messages, hasMore: false, dmSessionId: id, redirectRequired: false });
  }],
  ['POST', /^\/api\/v2\/messages\/direct$/, async (body) => ok({ message: await postMessage({ dmId: body.dmSessionId, parentId: body.replyTo || null, body }) }, 201)],
  ['GET', /^\/api\/v2\/dm\/[^/]+\/status$/, () => ok({ isMuted: false, isBlocked: false, isBlockedByOther: false })],
  ['GET', /^\/api\/v2\/messages\/thread\/([^/]+)$/, async (_, [id]) => {
    const parent = store().messages.find((m) => m.id === id);
    if (!parent) return notFound('Message not found');
    const replies = store().messages.filter((m) => m.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return ok({ parent: await messageOut(parent), replies: await Promise.all(replies.map(messageOut)) });
  }],
  ['POST', /^\/api\/v2\/messages\/thread\/([^/]+)$/, async (body, [id]) => {
    const parent = store().messages.find((m) => m.id === id);
    if (!parent) return notFound('Message not found');
    return ok({ reply: await postMessage({ channelId: parent.channelId, dmId: parent.dmId, parentId: id, body }) }, 201);
  }],
  ['POST', /^\/api\/v2\/messages\/([^/]+)\/react$/, async (body, [id]) => {
    const m = store().messages.find((x) => x.id === id);
    if (!m) return notFound('Message not found');
    const mine = (r) => r.emoji === body.emoji && r.userId === ME;
    m.reactions = m.reactions.some(mine) ? m.reactions.filter((r) => !mine(r)) : [...m.reactions, { emoji: body.emoji, userId: ME }];
    return ok({ message: await messageOut(m) });
  }],
  ['DELETE', /^\/api\/v2\/messages\/([^/]+)\/react$/, async (body, [id], query) => {
    const m = store().messages.find((x) => x.id === id);
    if (!m) return notFound('Message not found');
    const emoji = body?.emoji || query.get('emoji');
    m.reactions = m.reactions.filter((r) => !(r.emoji === emoji && r.userId === ME));
    return ok({ message: await messageOut(m) });
  }],
  ['GET', /^\/api\/v2\/messages\/workspace\/[^/]+\/activity$/, async () => {
    await Promise.all(store().messages.filter((m) => !m.parentId && !m.ciphertext).map(messageOut));
    return ok({ items: activity() });
  }],
  ['GET', /^\/api\/v2\/conversations\/([^/]+)\/keys$/, (_, [id], query) => ok({ conversationId: id, conversationType: query.get('type') || 'channel', encryptedKey: 'demo', ephemeralPublicKey: null, algorithm: 'DEMO', version: 1 })],
  ['POST', /^\/api\/v2\/conversations\/repair-access$/, () => ok({ success: true, message: 'Demo', total: 0, repaired: 0, alreadyHasKey: 0, failed: 0, details: [], dms: { total: 0, repaired: 0, failed: 0 } })],

  ['GET', /^\/api\/v2\/tasks$/, () => ok({ tasks: store().tasks.filter((t) => !t.deleted).map(taskOut) })],
  ['GET', /^\/api\/v2\/tasks\/([^/]+)$/, (_, [id]) => { const t = store().tasks.find((x) => x.id === id); return t ? ok({ task: taskOut(t) }) : notFound('Task not found'); }],
  ['POST', /^\/api\/v2\/tasks$/, (body) => {
    const assignees = body.assignmentType === 'self' || !(body.assignedToIds || []).length ? [ME] : body.assignedToIds;
    const t = {
      id: nextId('f2'), issueKey: `OL-${store().tasks.length + 1}`, title: String(body.title || 'Untitled task'), description: body.description || '',
      status: body.status || 'todo', priority: body.priority || 'medium', dueDate: body.dueDate || null, tags: body.tags || [],
      createdBy: ME, assignees, createdAt: nowIso(), updatedAt: nowIso(),
    };
    store().tasks.unshift(t);
    return ok({ message: 'Tasks created successfully', tasks: [taskOut(t)] }, 201);
  }],
  ['PUT', /^\/api\/v2\/tasks\/([^/]+)$/, (body, [id]) => {
    const t = store().tasks.find((x) => x.id === id);
    if (!t) return notFound('Task not found');
    for (const key of ['title', 'description', 'status', 'priority', 'dueDate', 'tags', 'blockedReason']) if (key in body) t[key] = body[key];
    if (Array.isArray(body.assignedToIds)) t.assignees = body.assignedToIds;
    t.updatedAt = nowIso();
    return ok({ task: taskOut(t) });
  }],
  ['DELETE', /^\/api\/v2\/tasks\/([^/]+)(\/permanent)?$/, (_, [id]) => { const t = store().tasks.find((x) => x.id === id); if (t) t.deleted = true; return ok({ message: 'Task deleted' }); }],

  ['GET', /^\/api\/v2\/notes$/, () => ok({ notes: store().notes.filter((n) => !n.deleted).map(noteOut) })],
  ['GET', /^\/api\/v2\/notes\/([^/]+)$/, (_, [id]) => { const n = store().notes.find((x) => x.id === id && !x.deleted); return n ? ok({ note: noteOut(n) }) : notFound('Note not found'); }],
  ['GET', /^\/api\/v2\/notes\/([^/]+)\/versions$/, () => ok({ versions: [] })],
  ['POST', /^\/api\/v2\/notes$/, (body) => {
    const n = { id: nextId('f3'), title: body.title || 'Untitled Note', content: body.content || '', type: body.type || 'note', ownerId: ME, tags: body.tags || [], createdAt: nowIso(), updatedAt: nowIso() };
    store().notes.unshift(n);
    return ok({ note: noteOut(n) }, 201);
  }],
  ['PUT', /^\/api\/v2\/notes\/([^/]+)$/, (body, [id]) => {
    const n = store().notes.find((x) => x.id === id);
    if (!n) return notFound('Note not found');
    for (const key of ['title', 'content', 'isPinned', 'tags', 'type']) if (key in body) n[key] = body[key];
    n.updatedAt = nowIso();
    return ok({ note: noteOut(n) });
  }],
  ['DELETE', /^\/api\/v2\/notes\/([^/]+)$/, (_, [id]) => { const n = store().notes.find((x) => x.id === id); if (n) n.deleted = true; return ok({ message: 'Note deleted' }); }],

  ['POST', /^\/api\/ai\/chat\/stream$/, (body) => ({ status: 200, stream: aiStream(demoAnswer(lastQuestion(body))), contentType: 'text/event-stream' })],
  ['POST', /^\/api\/ai\/chat$/, (body) => ok({ text: demoAnswer(lastQuestion(body)), provider: 'demo' })],
  ['POST', /^\/api\/ai\/smart-replies$/, () => ok({ replies: ['Sounds good, thanks!', 'On it, I will update the thread.', 'Can we talk about this at standup?'] })],
  ['POST', /^\/api\/ai\/.+$/, (body) => {
    const text = demoAnswer(lastQuestion(body) || 'catch me up');
    return ok({ text, summary: text, result: text, draft: text, content: text, provider: 'demo', tasks: [] });
  }],

  ['GET', /^\/api\/notifications$/, () => ok({ notifications: [], total: 0, unreadCount: 0, page: 1, pages: 0 })],
  ['GET', /^\/api\/notifications\/preferences$/, () => ok({ preferences: { email: false, meeting: true, message: true, push: true, task: true, threadReply: true } })],
  ['GET', /^\/api\/favorites\/[^/]+$/, () => ok({ favorites: [] })],
  ['GET', /^\/api\/scheduled-meetings$/, () => ok({ meetings: [] })],
  ['GET', /^\/api\/v2\/huddles\/history$/, () => ok({ huddles: [] })],
  ['GET', /^\/api\/marketplace\/apps$/, () => ok({ apps: [], total: 0, page: 1, pages: 0 })],
];

// Anything else: an empty answer in the common list shapes, so screens show their empty state.
const EMPTY = {
  items: [], data: [], results: [], list: [], messages: [], members: [], channels: [], tasks: [], notes: [], files: [], pages: [],
  apps: [], events: [], notifications: [], sessions: [], meetings: [], huddles: [], versions: [], users: [], total: 0, count: 0,
  hasMore: false, success: true,
};

/**
 * Answers one API call. `path` excludes the demo origin; `body` is parsed JSON (or null).
 * Returns { status, data }.
 */
export async function demoRequest(method, path, query, body) {
  const verb = method.toUpperCase();
  for (const [m, re, handler] of ROUTES) {
    if (m !== verb) continue;
    const match = path.match(re);
    if (match) return handler(body || {}, match.slice(1), query);
  }
  if (verb === 'GET') return ok({ ...EMPTY });
  // Writes the demo doesn't model are accepted and dropped.
  return ok({ success: true, demo: true, message: 'Saved in the demo only' });
}

/** Forget everything done in the demo. */
export function resetDemo() {
  db = null;
}
