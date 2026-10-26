'use strict';

/**
 * Task discussion ↔ linked chat thread (tasks.threadSync.js), with Nani, Mani, Teja and Nikil:
 * both directions, one copy however often it is retried, no loops, each side's access rules,
 * deletes and edits, and the retry job. The three collections are small in-memory stand-ins.
 */

// ── In-memory collections ────────────────────────────────────────────────────

const mockOid = (n) => n.toString(16).padStart(24, '0');
let mockNextId = 1000;

function mockGet(doc, path) {
    return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), doc);
}
function mockSet(doc, path, value) {
    const keys = path.split('.');
    let o = doc;
    for (const k of keys.slice(0, -1)) { if (o[k] == null) o[k] = {}; o = o[k]; }
    o[keys[keys.length - 1]] = value;
}
const mockStr = (v) => (v == null ? v : String(v._id || v));
function mockMatches(doc, query) {
    return Object.entries(query || {}).every(([k, want]) => {
        const have = mockGet(doc, k);
        if (want && typeof want === 'object' && !Array.isArray(want) && !(want instanceof Date)) {
            if ('$ne' in want) return mockStr(have) !== mockStr(want.$ne) && !(want.$ne === true && have === true);
            if ('$in' in want) return want.$in.map(mockStr).includes(mockStr(have));
            return true;
        }
        if (want === null) return have == null;
        return mockStr(have) === mockStr(want);
    });
}
function mockChain(value) {
    const c = { lean: () => c, select: () => c, limit: () => c, sort: () => c, then: (res, rej) => Promise.resolve(value).then(res, rej) };
    return c;
}
function mockCollection(unique = []) {
    const docs = [];
    const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : d);
    const apply = (doc, update) => {
        for (const [k, v] of Object.entries(update.$set || {})) mockSet(doc, k, v instanceof Date ? v.toISOString() : v);
        for (const k of Object.keys(update.$unset || {})) mockSet(doc, k, undefined);
        for (const [k, v] of Object.entries(update.$inc || {})) mockSet(doc, k, (mockGet(doc, k) || 0) + v);
    };
    const col = {
        docs,
        failNextCreate: null,
        async create(input) {
            if (col.failNextCreate) { const e = col.failNextCreate; col.failNextCreate = null; throw e; }
            const doc = { _id: mockOid(mockNextId++), createdAt: new Date().toISOString(), ...clone(input) };
            for (const keys of unique) {
                if (keys.every((k) => mockGet(doc, k) != null) && docs.some((d) => keys.every((k) => mockStr(mockGet(d, k)) === mockStr(mockGet(doc, k))))) {
                    throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
                }
            }
            docs.push(doc);
            return { ...clone(doc), toObject: () => clone(doc) };
        },
        find: (q) => mockChain(docs.filter((d) => mockMatches(d, q)).map(clone)),
        findOne: (q) => mockChain(clone(docs.find((d) => mockMatches(d, q)) || null)),
        findById: (id) => mockChain(clone(docs.find((d) => mockStr(d._id) === mockStr(id)) || null)),
        async updateOne(q, update, opts = {}) {
            let doc = docs.find((d) => mockMatches(d, q));
            if (!doc && opts.upsert) { doc = { _id: mockOid(mockNextId++), ...clone(q), ...clone(update.$setOnInsert || {}) }; docs.push(doc); }
            if (doc) apply(doc, update);
            return { modifiedCount: doc ? 1 : 0 };
        },
        async updateMany(q, update) {
            const hit = docs.filter((d) => mockMatches(d, q));
            hit.forEach((d) => apply(d, update));
            return { modifiedCount: hit.length };
        },
        findOneAndUpdate(q, update, opts = {}) {
            let doc = docs.find((d) => mockMatches(d, q));
            if (!doc && opts.upsert) { doc = { _id: mockOid(mockNextId++), ...clone(q), ...clone(update.$setOnInsert || {}) }; docs.push(doc); }
            if (doc) apply(doc, update);
            return mockChain(clone(doc));
        },
    };
    return col;
}

const mockDb = {
    TaskDiscussion: mockCollection([['task']]),
    TaskComment: mockCollection([['task', 'mirror.messageId']]),
    Message: mockCollection([['taskComment']]),
};
jest.mock('../taskDiscussion.model', () => ({ TaskDiscussion: mockDb.TaskDiscussion, TaskComment: mockDb.TaskComment }));
jest.mock('../../../modules/messages/message.model.js', () => mockDb.Message);

// ── People, conversations, tasks ─────────────────────────────────────────────

const [NANI, MANI, TEJA, NIKIL] = [1, 2, 3, 4].map(mockOid);
const WS = mockOid(50);
const PUBLIC = mockOid(60); // #general: Nani, Mani, Teja (public: the whole workspace reads its threads)
const PRIVATE = mockOid(61); // #core: Nani and Mani
const GROUP = mockOid(70); // Nani, Mani, Teja; Nikil joins later
const mockWorld = {
    channels: {
        [PUBLIC]: { _id: PUBLIC, isPrivate: false, workspace: WS, members: [NANI, MANI, TEJA].map((user) => ({ user })) },
        [PRIVATE]: { _id: PRIVATE, isPrivate: true, workspace: WS, members: [NANI, MANI].map((user) => ({ user })) },
    },
    dms: {
        [GROUP]: { _id: GROUP, isGroup: true, workspace: WS, participants: [NANI, MANI, TEJA, NIKIL], memberSince: [{ user: NIKIL, at: '2026-06-01T00:00:00.000Z' }] },
    },
    tasks: {},
};
const mockWsMembers = [NANI, MANI, TEJA, NIKIL].map((user) => ({ user, status: 'active' }));

jest.mock('../../../identity', () => ({
    workspaces: {
        findById: jest.fn(async () => ({ _id: mockOid(50), members: mockWsMembers })),
        listMembers: jest.fn(async () => mockWsMembers),
    },
    users: {
        findById: jest.fn(async (id) => ({ _id: id, username: `u${String(id).slice(-1)}` })),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [String(id), { _id: String(id), username: `u${String(id).slice(-1)}` }]))),
    },
}));
jest.mock('../../channels/channel.model.js', () => ({ findById: (id) => mockChain(mockWorld.channels[String(id)] || null) }));
jest.mock('../../../../models/DMSession', () => ({ findById: (id) => mockChain(mockWorld.dms[String(id)] || null) }));

/** Who reads a conversation in chat, and from when (a group member: from their join date). */
function mockCanRead(userId, msg) {
    const ch = msg.channel && mockWorld.channels[String(msg.channel)];
    if (ch) return !ch.isPrivate || ch.members.some((m) => m.user === String(userId));
    const dm = msg.dm && mockWorld.dms[String(msg.dm)];
    if (!dm || !dm.participants.includes(String(userId))) return false;
    const row = dm.memberSince.find((m) => m.user === String(userId));
    return !row || new Date(msg.createdAt || 0) >= new Date(row.at);
}
jest.mock('../../../modules/threads/threadAccess', () => ({
    checkThreadAccess: jest.fn(async (root, userId) => (mockCanRead(userId, root) ? { ok: true } : { ok: false, status: 403 })),
}));
jest.mock('../../../modules/conversations/conversationAccess', () => ({
    filterReadable: jest.fn(async (items, userId, messageOf) => items.filter((i) => mockCanRead(userId, messageOf(i)))),
}));

/** Tasks: who may see each (task.viewers), as tasks.service._loadTaskForDiscussion decides. */
jest.mock('../tasks.service', () => ({
    _loadTaskForDiscussion: jest.fn(async (userId, taskId) => {
        const t = mockWorld.tasks[String(taskId)];
        if (!t || !t.viewers.includes(String(userId))) throw Object.assign(new Error('nope'), { statusCode: 403 });
        return { task: t, isManager: false };
    }),
    _loadRawTask: jest.fn(async (taskId) => mockWorld.tasks[String(taskId)] || null),
    _setWatchers: jest.fn(),
}));

const mockEncrypt = { fail: 0 };
jest.mock('../../../modules/conversations/cryptoUtils', () => ({
    encryptForConversation: jest.fn(async (_id, _type, text) => {
        if (mockEncrypt.fail > 0) { mockEncrypt.fail -= 1; throw new Error('key service down'); }
        return { ciphertext: Buffer.from(text).toString('base64'), messageIv: 'iv', keyVersion: 1 };
    }),
}));
jest.mock('../../../modules/threads/threads.service', () => ({
    postEncryptedReply: jest.fn(async (io, { parent, senderId, ciphertext, messageIv, keyVersion, extra = {} }) => {
        const saved = await mockDb.Message.create({
            type: 'message', sender: senderId, parentId: parent._id, payload: { ciphertext, messageIv, keyVersion },
            ...(parent.channel ? { channel: parent.channel } : { dm: parent.dm }), workspace: parent.workspace, ...extra,
        });
        return saved.toObject();
    }),
    recountThread: jest.fn(async () => ({ replyCount: 1, lastReplyAt: null })),
    emitThreadCounters: jest.fn(),
}));
jest.mock('../../../modules/conversations/conversationRooms', () => ({ emitAboutMessage: jest.fn() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ taskComment: jest.fn(async () => null) }));
jest.mock('../tasks.shared', () => ({ ...jest.requireActual('../tasks.shared'), emitToTaskAudience: jest.fn() }));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));

const sync = require('../tasks.threadSync');
const { emitAboutMessage } = require('../../../modules/conversations/conversationRooms');
const notificationService = require('../../../modules/notifications/notificationService');

// ── Helpers ──────────────────────────────────────────────────────────────────

const decode = (m) => Buffer.from(m.payload.ciphertext, 'base64').toString();
let n = 0;
function fakeIo() {
    const sent = [];
    return { sent, to: (rooms) => ({ emit: (event, payload) => sent.push({ rooms: [].concat(rooms), event, payload }) }) };
}
async function thread({ channel = null, dm = null, createdAt = '2026-07-01T00:00:00.000Z' } = {}) {
    const root = await mockDb.Message.create({ type: 'message', sender: NANI, workspace: WS, createdAt, ...(channel ? { channel } : { dm }), payload: { ciphertext: 'cm9vdA==', messageIv: 'iv' } });
    return root.toObject();
}
async function task(root, { visibility = 'workspace', viewers = [NANI, MANI, TEJA, NIKIL] } = {}) {
    n += 1;
    const t = { _id: mockOid(900 + n), workspace: WS, title: `Task ${n}`, createdBy: NANI, assignedTo: [MANI], watchers: [], visibility, viewers };
    mockWorld.tasks[t._id] = t;
    await sync.linkThread(t, root._id);
    return t;
}
async function comment(t, author, text) {
    const c = await mockDb.TaskComment.create({ task: t._id, workspace: WS, kind: 'comment', author, text, attachments: [] });
    return c.toObject();
}
async function reply(root, sender, text, extra = {}) {
    const r = await mockDb.Message.create({
        type: 'message', sender, parentId: root._id, workspace: WS, ...(root.channel ? { channel: root.channel } : { dm: root.dm }),
        payload: { ciphertext: Buffer.from(text).toString('base64'), messageIv: 'iv', keyVersion: 1 }, ...extra,
    });
    return r.toObject();
}
const copiesOf = (r) => mockDb.TaskComment.docs.filter((c) => c.mirror?.messageId === r._id);
const commentDoc = (c) => mockDb.TaskComment.docs.find((d) => d._id === c._id);

beforeEach(() => {
    jest.clearAllMocks();
    mockEncrypt.fail = 0;
    sync._env.dbReady = () => true;
});

// ── Task → thread ────────────────────────────────────────────────────────────

describe('a task comment goes to the linked thread', () => {
    test('as a reply from its author, encrypted, pointing back; the comment records it', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, NANI, 'Let us ship Friday');
        const s = await sync.commentToThread(c, t);
        expect(s.state).toBe('synced');
        const posted = mockDb.Message.docs.find((m) => m.taskComment === c._id);
        expect(posted).toMatchObject({ sender: NANI, parentId: root._id, taskCommentTask: t._id, clientMessageId: `taskc:${c._id}` });
        expect(decode(posted)).toBe('Let us ship Friday');
        expect(commentDoc(c).sync).toMatchObject({ state: 'synced', messageId: posted._id });
    });

    test('once, however often it is retried', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, MANI, 'Once');
        await sync.commentToThread(c, t);
        await sync.commentToThread(c, t);
        await sync.commentToThread(commentDoc(c), t);
        expect(mockDb.Message.docs.filter((m) => m.taskComment === c._id)).toHaveLength(1);
    });

    test('files show by name', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = (await mockDb.TaskComment.create({ task: t._id, kind: 'comment', author: NANI, text: 'See', attachments: [{ url: '/f', name: 'plan.pdf' }] })).toObject();
        await sync.commentToThread(c, t);
        expect(decode(mockDb.Message.docs.find((m) => m.taskComment === c._id))).toBe('See\n📎 plan.pdf');
    });

    test("not when people in the thread can't see the task (a private task, a public channel)", async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root, { visibility: 'private', viewers: [NANI, MANI] });
        const c = await comment(t, NANI, 'Private plan');
        expect(await sync.commentToThread(c, t)).toMatchObject({ state: 'skipped', reason: 'audience' });
        expect(mockDb.Message.docs.some((m) => m.taskComment === c._id)).toBe(false);
    });

    test('a private task whose people are exactly the private channel: shared', async () => {
        const root = await thread({ channel: PRIVATE });
        const t = await task(root, { visibility: 'private', viewers: [NANI, MANI] });
        expect((await sync.commentToThread(await comment(t, NANI, 'ok'), t)).state).toBe('synced');
    });

    test("not when its author can't post in the thread, or the thread is locked", async () => {
        const root = await thread({ channel: PRIVATE });
        const t = await task(root);
        expect(await sync.commentToThread(await comment(t, TEJA, 'hi'), t)).toMatchObject({ state: 'skipped', reason: 'author_cannot_post' });
        mockDb.Message.docs.find((m) => m._id === root._id).threadLockedAt = new Date().toISOString();
        expect(await sync.commentToThread(await comment(t, NANI, 'hi'), t)).toMatchObject({ state: 'skipped', reason: 'thread_locked' });
    });

    test('a task without a linked thread: nothing happens', async () => {
        const t = { _id: mockOid(990), workspace: WS, visibility: 'workspace', viewers: [NANI] };
        expect(await sync.commentToThread(await comment(t, NANI, 'x'), t)).toEqual({ state: 'none' });
    });

    test('deleting the comment deletes its reply (for everyone)', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, NANI, 'Oops');
        await sync.commentToThread(c, t);
        expect(await sync.commentDeleted(c, fakeIo(), { deletedBy: NANI })).toBe(true);
        expect(mockDb.Message.docs.find((m) => m.taskComment === c._id)).toMatchObject({ isDeletedUniversally: true, isDeleted: true });
        expect(emitAboutMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ taskComment: c._id }), 'message:deleted', expect.objectContaining({ parentId: root._id }), expect.anything());
    });
});

// ── Thread → task ────────────────────────────────────────────────────────────

describe('a thread reply goes to the linked tasks', () => {
    test('as a comment from its author carrying the encrypted text; once', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const r = await reply(root, MANI, 'On it');
        expect(await sync.replyToTasks(r, root)).toBe(1);
        expect(await sync.replyToTasks(r, root)).toBe(0);
        const [copy] = copiesOf(r);
        expect(copiesOf(r)).toHaveLength(1);
        expect(copy).toMatchObject({ task: t._id, author: MANI, kind: 'comment', text: '' });
        expect(copy.mirror).toMatchObject({ rootId: root._id, conversationId: PUBLIC, conversationType: 'channel', payload: { ciphertext: r.payload.ciphertext, messageIv: 'iv' } });
    });

    test('into every task linked to the thread', async () => {
        const root = await thread({ channel: PUBLIC });
        await task(root);
        await task(root);
        expect(await sync.replyToTasks(await reply(root, NANI, 'both'), root)).toBe(2);
    });

    test('never copies back a copy, the "Task created" reply or automatic messages (no loops)', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, NANI, 'from the task');
        await sync.commentToThread(c, t);
        const copy = mockDb.Message.docs.find((m) => m.taskComment === c._id);
        expect(await sync.replyToTasks(copy, root)).toBe(0);
        expect(await sync.replyToTasks(await reply(root, NANI, '📋 Task created', { linkedTaskId: t._id }), root)).toBe(0);
        expect(await sync.replyToTasks(await reply(root, NANI, 'x', { type: 'system' }), root)).toBe(0);
        expect(mockDb.TaskComment.docs.filter((d) => d.task === t._id && d.mirror)).toHaveLength(0);
    });

    test("not into a task its author can't see", async () => {
        const root = await thread({ channel: PUBLIC });
        await task(root, { visibility: 'private', viewers: [NANI, MANI] });
        expect(await sync.replyToTasks(await reply(root, TEJA, 'me too'), root)).toBe(0);
    });

    test('shown in the task only to people who can read the thread: a group Nikil joined later', async () => {
        // The group's thread is from July; Nikil was added "from now on" in August.
        mockWorld.dms[GROUP].memberSince = [{ user: NIKIL, at: '2026-08-01T00:00:00.000Z' }];
        const root = await thread({ dm: GROUP, createdAt: '2026-07-01T00:00:00.000Z' });
        const t = await task(root); // a workspace task: everyone sees the task itself
        const io = fakeIo();
        const r = await reply(root, MANI, 'group only');
        await sync.replyToTasks(r, root, io);
        const list = mockDb.TaskComment.docs.filter((d) => d.task === t._id);
        expect((await sync.visibleEntries(list, TEJA)).map((d) => d._id)).toEqual(list.map((d) => d._id));
        expect(await sync.visibleEntries(list, NIKIL)).toEqual([]);
        // Live: only to the people who can read the thread, never the workspace room.
        const live = io.sent.find((e) => e.event === 'task:discussion');
        expect(live.rooms).toEqual(expect.arrayContaining([`user_${NANI}`, `user:${MANI}`, `user_${TEJA}`]));
        expect(live.rooms.some((room) => room.includes(NIKIL) || room.startsWith('workspace'))).toBe(false);
        // Notifications likewise (not Mani, the author; not Nikil).
        const told = notificationService.taskComment.mock.calls.map(([, p]) => p.recipientId);
        expect(told).not.toContain(NIKIL);
        expect(told).not.toContain(MANI);
    });

    test('a reply deleted for everyone leaves the task; an edit updates the copy', async () => {
        const root = await thread({ channel: PUBLIC });
        await task(root);
        const r = await reply(root, MANI, 'v1');
        await sync.replyToTasks(r, root);
        const edited = { ...r, payload: { ciphertext: Buffer.from('v2').toString('base64'), messageIv: 'iv2', keyVersion: 1 } };
        expect(await sync.replyEdited(edited)).toBe(1);
        expect(copiesOf(r)[0].mirror.payload).toMatchObject({ messageIv: 'iv2' });
        expect(await sync.replyDeleted(r)).toBe(1);
        expect(copiesOf(r)[0].deletedAt).toBeTruthy();
        expect(copiesOf(r)[0].mirror.payload).toBeNull();
    });
});

// ── Retries ──────────────────────────────────────────────────────────────────

describe('failures are retried', () => {
    test('a comment whose reply could not be posted is pending, then synced by the job', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, NANI, 'retry me');
        mockEncrypt.fail = 1;
        expect(await sync.commentToThread(c, t)).toMatchObject({ state: 'pending', attempts: 1 });
        await sync.retryPending();
        expect(commentDoc(c).sync.state).toBe('synced');
        expect(mockDb.Message.docs.filter((m) => m.taskComment === c._id)).toHaveLength(1);
    });

    test('gives up after a few attempts', async () => {
        const root = await thread({ channel: PUBLIC });
        const t = await task(root);
        const c = await comment(t, NANI, 'never');
        mockEncrypt.fail = 99;
        for (let i = 0; i < sync.MAX_ATTEMPTS; i += 1) await sync.commentToThread(commentDoc(c), t);
        expect(commentDoc(c).sync).toMatchObject({ state: 'failed', attempts: sync.MAX_ATTEMPTS });
    });

    test('a reply that could not be copied is marked, then copied by the job', async () => {
        const root = await thread({ channel: PUBLIC });
        await task(root);
        const r = await reply(root, MANI, 'later');
        mockDb.TaskComment.failNextCreate = new Error('db hiccup');
        expect(await sync.replyToTasks(r, root)).toBe(0);
        expect(mockDb.Message.docs.find((m) => m._id === r._id).taskMirror).toBe('pending');
        await sync.retryPending();
        expect(copiesOf(r)).toHaveLength(1);
        expect(mockDb.Message.docs.find((m) => m._id === r._id).taskMirror).toBeUndefined();
    });
});
