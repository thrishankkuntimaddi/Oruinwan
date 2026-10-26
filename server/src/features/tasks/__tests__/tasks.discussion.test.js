'use strict';

/**
 * Task discussions: who takes part, automatic status / assignee / due-date entries,
 * resolved on Done (reopened when the task leaves Done), comments and notifications,
 * adding / removing people, and the linked thread.
 */

jest.mock('../tasks.service', () => ({
    _loadTaskForDiscussion: jest.fn(),
    _loadRawTask: jest.fn(),
    _setWatchers: jest.fn().mockResolvedValue(),
}));
jest.mock('../taskDiscussion.model', () => ({
    TaskDiscussion: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), exists: jest.fn(), updateOne: jest.fn() },
    TaskComment: { find: jest.fn(), create: jest.fn(), insertMany: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('../../../identity', () => ({
    users: {
        findById: jest.fn(async (id) => ({ _id: id, username: `name-${String(id).slice(-1)}` })),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [String(id), { _id: String(id), username: `name-${String(id).slice(-1)}` }]))),
    },
    workspaces: { findById: jest.fn() },
}));
jest.mock('../../../modules/notifications/notificationService', () => ({
    taskComment: jest.fn().mockResolvedValue(null),
    taskDiscussionAdded: jest.fn().mockResolvedValue([]),
}));
jest.mock('../tasks.shared', () => ({
    ...jest.requireActual('../tasks.shared'),
    emitToTaskAudience: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));
jest.mock('../../../modules/messages/message.model.js', () => ({ findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), find: jest.fn() }));
jest.mock('../../channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../modules/conversations/cryptoUtils', () => ({ encryptForConversation: jest.fn() }));
jest.mock('../../../modules/threads/threads.service', () => ({ emitThreadCounters: jest.fn(), followAndNotify: jest.fn().mockResolvedValue(0), LIVE_REPLY: { isDeleted: { $ne: true } } }));
jest.mock('../../../modules/threads/threadAccess', () => ({ checkConversationAccess: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (d) => d) }));

const tasksService = require('../tasks.service');
const { TaskDiscussion, TaskComment } = require('../taskDiscussion.model');
const identity = require('../../../identity');
const notificationService = require('../../../modules/notifications/notificationService');
const { emitToTaskAudience } = require('../tasks.shared');
const discussion = require('../tasks.discussion');

const oid = (n) => n.toString(16).padStart(24, '0');
const CREATOR = oid(1);
const ASSIGNEE = oid(2);
const WATCHER = oid(3);
const MEMBER = oid(4);
const ADDED = oid(5);
const ADMIN = oid(6);
const OUTSIDER = oid(9);
const WS = oid(30);
const TASK = oid(100);

const lean = (v) => ({ lean: async () => v, sort: () => ({ limit: () => ({ lean: async () => v }) }), select: () => ({ lean: async () => v }) });
const flush = () => new Promise((r) => setImmediate(r));
const io = { to: jest.fn(() => ({ emit: jest.fn() })) };

let task;
let stored;
let disc;

beforeEach(() => {
    jest.clearAllMocks();
    discussion._env.dbReady = () => true;
    task = { _id: TASK, workspace: WS, title: 'Ship it', createdBy: CREATOR, assignedTo: [ASSIGNEE], watchers: [WATCHER], status: 'in_progress', visibility: 'workspace' };
    disc = { task: TASK, participants: [] };
    stored = [];
    tasksService._loadTaskForDiscussion.mockImplementation(async (userId) => ({ task, isManager: userId === ADMIN }));
    tasksService._loadRawTask.mockImplementation(async () => task);
    TaskDiscussion.findOne.mockImplementation(() => lean(disc));
    TaskDiscussion.findOneAndUpdate.mockImplementation((q, update) => {
        if (update.$addToSet) disc = { ...disc, participants: [...new Set([...disc.participants, ...update.$addToSet.participants.$each])] };
        if (update.$pull) disc = { ...disc, participants: disc.participants.filter((p) => !update.$pull.participants.$in.includes(p)) };
        return lean(disc);
    });
    TaskComment.find.mockImplementation(() => lean(stored));
    TaskComment.create.mockImplementation(async (doc) => {
        const saved = { _id: oid(500 + stored.length), createdAt: new Date(), ...doc };
        stored.push(saved);
        return { ...saved, toObject: () => saved };
    });
    TaskComment.insertMany.mockImplementation(async (docs) => docs.map((d, i) => {
        const saved = { _id: oid(700 + i), createdAt: new Date(), ...d };
        stored.push(saved);
        return saved;
    }));
    identity.workspaces.findById.mockResolvedValue({
        _id: WS,
        members: [CREATOR, ASSIGNEE, WATCHER, MEMBER, ADDED, ADMIN].map((user) => ({ user, status: 'active', role: user === ADMIN ? 'admin' : 'member' })),
    });
});

describe('automatic entries', () => {
    test('status changes, resolved on Done, reopened when it leaves Done', () => {
        expect(discussion.eventsForActivity('status_changed', { from: 'todo', to: 'in_progress' }))
            .toEqual([{ type: 'status', from: 'todo', to: 'in_progress', meta: null }]);
        expect(discussion.eventsForActivity('status_changed', { from: 'review', to: 'done' }).map((e) => e.type)).toEqual(['status', 'resolved']);
        expect(discussion.eventsForActivity('status_changed', { from: 'done', to: 'in_progress' }).map((e) => e.type)).toEqual(['status', 'reopened']);
    });

    test('reassignments, due-date and priority changes; other activity stays out', () => {
        expect(discussion.eventsForActivity('assignee_added', { to: MEMBER })).toEqual([{ type: 'assignee_added', to: MEMBER }]);
        expect(discussion.eventsForActivity('transfer_approved', { from: ASSIGNEE, to: MEMBER })).toEqual([{ type: 'reassigned', from: ASSIGNEE, to: MEMBER }]);
        expect(discussion.eventsForActivity('updated', { field: 'dueDate', from: null, to: '2026-11-01T00:00:00.000Z' }))
            .toEqual([{ type: 'due_date', from: null, to: '2026-11-01T00:00:00.000Z' }]);
        expect(discussion.eventsForActivity('updated', { field: 'priority', from: 'low', to: 'high' })).toEqual([{ type: 'priority', from: 'low', to: 'high' }]);
        expect(discussion.eventsForActivity('updated', { field: 'description' })).toEqual([]);
        expect(discussion.eventsForActivity('created', {})).toEqual([]);
    });

    test('recordActivity writes the entries and sends them to the task audience in real time', async () => {
        const entries = await discussion.recordActivity(TASK, ASSIGNEE, 'status_changed', { from: 'review', to: 'done' }, io);
        expect(TaskComment.insertMany).toHaveBeenCalledWith([
            expect.objectContaining({ task: TASK, kind: 'event', author: ASSIGNEE, event: { type: 'status', from: 'review', to: 'done', meta: null } }),
            expect.objectContaining({ kind: 'event', event: { type: 'resolved' } }),
        ]);
        expect(entries.map((e) => e.event.type)).toEqual(['status', 'resolved']);
        expect(entries[0].author).toMatchObject({ _id: ASSIGNEE, username: 'name-2' });
        expect(emitToTaskAudience).toHaveBeenCalledWith(io, task, 'task:discussion', expect.objectContaining({ taskId: TASK }), []);
    });

    test('recordActivity never throws and does nothing without a database', async () => {
        discussion._env.dbReady = () => false;
        await expect(discussion.recordActivity(TASK, ASSIGNEE, 'status_changed', { from: 'todo', to: 'done' })).resolves.toEqual([]);
        expect(TaskComment.insertMany).not.toHaveBeenCalled();
        discussion._env.dbReady = () => true;
        tasksService._loadRawTask.mockRejectedValueOnce(new Error('db down'));
        await expect(discussion.recordActivity(TASK, ASSIGNEE, 'status_changed', { from: 'todo', to: 'done' })).resolves.toEqual([]);
    });
});

describe('reading a discussion', () => {
    test('participants are the creator, assignees, watchers and people added; resolved follows Done', async () => {
        disc.participants = [ADDED];
        task.status = 'done';
        task.completedAt = new Date('2026-10-20T00:00:00Z');
        const res = await discussion.getDiscussion(ASSIGNEE, TASK);
        expect(res.participants.map((p) => [p._id, p.roles])).toEqual([
            [CREATOR, ['creator']], [ASSIGNEE, ['assignee']], [WATCHER, ['watcher']], [ADDED, ['added']],
        ]);
        expect(res.resolved).toBe(true);
        expect(res.resolvedAt).toEqual(task.completedAt);
        expect(res.permissions).toEqual({ canComment: true, canAddPeople: true, canModerate: false });
        expect(res.linkedThread).toBeNull();
    });

    test('a watcher can comment but not add people; the creator and workspace admins moderate', async () => {
        expect((await discussion.getDiscussion(WATCHER, TASK)).permissions).toEqual({ canComment: true, canAddPeople: false, canModerate: false });
        expect((await discussion.getDiscussion(CREATOR, TASK)).permissions).toEqual({ canComment: true, canAddPeople: true, canModerate: true });
        expect((await discussion.getDiscussion(ADMIN, TASK)).permissions).toEqual({ canComment: true, canAddPeople: true, canModerate: true });
    });

    test('someone who cannot see the task gets the task service\'s 403', async () => {
        tasksService._loadTaskForDiscussion.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 403 }));
        await expect(discussion.getDiscussion(OUTSIDER, TASK)).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('comments', () => {
    test('a comment reaches every other participant and in real time', async () => {
        const { entry } = await discussion.postComment(ASSIGNEE, TASK, { text: '  On it  ' }, io);
        expect(entry).toMatchObject({ kind: 'comment', text: 'On it', author: { _id: ASSIGNEE } });
        expect(tasksService._setWatchers).not.toHaveBeenCalled();
        expect(emitToTaskAudience).toHaveBeenCalledWith(io, expect.objectContaining({ _id: TASK }), 'task:discussion', { taskId: TASK, entry }, []);
        await flush();
        const recipients = notificationService.taskComment.mock.calls.map(([, a]) => a.recipientId).sort();
        expect(recipients).toEqual([CREATOR, WATCHER].sort());
        expect(notificationService.taskComment.mock.calls[0][1]).toMatchObject({ commenterUsername: 'name-2', taskTitle: 'Ship it', taskId: TASK, workspaceId: WS });
    });

    test('commenting on a task you can see makes you a participant (watcher)', async () => {
        await discussion.postComment(MEMBER, TASK, { text: 'I can help' }, io);
        expect(tasksService._setWatchers).toHaveBeenCalledWith(TASK, { add: [MEMBER] });
        await flush();
        expect(notificationService.taskComment.mock.calls.map(([, a]) => a.recipientId).sort()).toEqual([ASSIGNEE, CREATOR, WATCHER].sort());
    });

    test('an @mention by the creator adds the person to the discussion', async () => {
        const { entry } = await discussion.postComment(CREATOR, TASK, { text: 'cc @name-4' }, io);
        expect(entry.mentions).toEqual([MEMBER]);
        expect(tasksService._setWatchers).toHaveBeenCalledWith(TASK, { add: [MEMBER] });
        expect(disc.participants).toEqual([MEMBER]);
    });

    test('an @mention by a watcher does not add anyone', async () => {
        await discussion.postComment(WATCHER, TASK, { text: 'cc @name-4' }, io);
        expect(tasksService._setWatchers).not.toHaveBeenCalled();
        expect(disc.participants).toEqual([]);
    });

    test('empty and over-long comments are refused', async () => {
        await expect(discussion.postComment(ASSIGNEE, TASK, { text: '   ' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(discussion.postComment(ASSIGNEE, TASK, { text: 'x'.repeat(10001) })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('only the author, the creator or an admin deletes a comment', async () => {
        TaskComment.findOne.mockImplementation(() => lean({ _id: oid(501), task: TASK, kind: 'comment', author: ASSIGNEE }));
        await expect(discussion.deleteComment(WATCHER, TASK, oid(501), io)).rejects.toMatchObject({ statusCode: 403 });
        await expect(discussion.deleteComment(CREATOR, TASK, oid(501), io)).resolves.toEqual({ deleted: oid(501) });
        expect(TaskComment.updateOne).toHaveBeenCalledWith({ _id: oid(501) }, { $set: expect.objectContaining({ text: '', attachments: [] }) });
    });
});

describe('people', () => {
    test('an assignee adds a workspace member: they become a participant, see an entry and are notified', async () => {
        const res = await discussion.addParticipants(ASSIGNEE, TASK, [ADDED, CREATOR], io);
        expect(res.added).toEqual([ADDED]);
        expect(tasksService._setWatchers).toHaveBeenCalledWith(TASK, { add: [ADDED] });
        expect(disc.participants).toEqual([ADDED]);
        expect(res.entry).toMatchObject({ kind: 'event', event: { type: 'participant_added', to: [ADDED] } });
        await flush();
        expect(notificationService.taskDiscussionAdded).toHaveBeenCalledWith(io, expect.objectContaining({ recipientIds: [ADDED], adderUsername: 'name-2', taskId: TASK }));
    });

    test('a watcher cannot add people; non-members cannot be added', async () => {
        await expect(discussion.addParticipants(WATCHER, TASK, [ADDED])).rejects.toMatchObject({ statusCode: 403 });
        await expect(discussion.addParticipants(CREATOR, TASK, [OUTSIDER])).rejects.toMatchObject({ statusCode: 400 });
    });

    test('people leave or are removed by the creator; the creator and assignees always stay', async () => {
        disc.participants = [ADDED];
        await expect(discussion.removeParticipant(WATCHER, TASK, ADDED)).rejects.toMatchObject({ statusCode: 403 });
        await expect(discussion.removeParticipant(CREATOR, TASK, ASSIGNEE)).rejects.toMatchObject({ statusCode: 400 });
        await expect(discussion.removeParticipant(ADDED, TASK, ADDED)).resolves.toEqual({ removed: ADDED });
        expect(disc.participants).toEqual([]);
        await expect(discussion.removeParticipant(CREATOR, TASK, WATCHER)).resolves.toEqual({ removed: WATCHER });
        expect(tasksService._setWatchers).toHaveBeenLastCalledWith(TASK, { remove: [WATCHER] });
    });

    test('explicit participants may open the task; lookups never throw', async () => {
        TaskDiscussion.exists.mockResolvedValueOnce({ _id: 'd' });
        expect(await discussion.isExplicitParticipant(TASK, ADDED)).toBe(true);
        TaskDiscussion.exists.mockRejectedValueOnce(new Error('down'));
        expect(await discussion.isExplicitParticipant(TASK, ADDED)).toBe(false);
        discussion._env.dbReady = () => false;
        expect(await discussion.isExplicitParticipant(TASK, ADDED)).toBe(false);
    });
});

describe('linked thread', () => {
    const Message = require('../../../modules/messages/message.model.js');
    const Channel = require('../../channels/channel.model.js');
    const { encryptForConversation } = require('../../../modules/conversations/cryptoUtils');
    const threads = require('../../../modules/threads/threads.service');
    const { checkConversationAccess } = require('../../../modules/threads/threadAccess');
    const ROOT = oid(200);
    const REPLY = oid(201);
    const CHANNEL = oid(10);
    let messages;

    beforeEach(() => {
        messages = {
            [ROOT]: { _id: ROOT, channel: CHANNEL, workspace: WS, sender: MEMBER, replyCount: 2, payload: { ciphertext: 'root', messageIv: 'iv' } },
            [REPLY]: { _id: REPLY, channel: CHANNEL, parentId: ROOT, sender: ASSIGNEE },
        };
        Message.findById.mockImplementation((id) => lean(messages[String(id)] || null));
        Message.create.mockImplementation(async (doc) => ({ _id: oid(300), createdAt: new Date(), ...doc, toObject() { return { ...this }; } }));
        Message.findByIdAndUpdate.mockImplementation(() => lean({ ...messages[ROOT], replyCount: 3 }));
        Channel.findById.mockImplementation(() => lean({ name: 'launch' }));
        encryptForConversation.mockResolvedValue({ ciphertext: 'enc', messageIv: 'iv2' });
    });

    test('converting a reply posts "Task created: …" in its thread and links the task back', async () => {
        await discussion.linkTaskToThread({ task: { ...task, _id: TASK }, message: messages[REPLY], userId: CREATOR, io });
        expect(encryptForConversation).toHaveBeenCalledWith(CHANNEL, 'channel', '📋 Task created: Ship it');
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
            parentId: ROOT, channel: CHANNEL, sender: CREATOR, linkedTaskId: TASK, payload: { ciphertext: 'enc', messageIv: 'iv2', isEncrypted: true },
        }));
        expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(ROOT, expect.objectContaining({ $inc: { replyCount: 1 } }), { new: true });
        expect(threads.followAndNotify).toHaveBeenCalled();
        expect(stored).toEqual([expect.objectContaining({ kind: 'event', event: { type: 'thread_linked', meta: { messageId: ROOT, channelId: CHANNEL, dmId: null, channelName: 'launch' } } })]);
    });

    test('a locked thread, or one the server cannot encrypt for, gets no reply (the task still links)', async () => {
        messages[ROOT].threadLockedAt = new Date();
        await discussion.linkTaskToThread({ task, message: messages[ROOT], userId: CREATOR, io });
        expect(Message.create).not.toHaveBeenCalled();
        delete messages[ROOT].threadLockedAt;
        encryptForConversation.mockRejectedValueOnce(new Error('no key'));
        await discussion.linkTaskToThread({ task, message: messages[ROOT], userId: CREATOR, io });
        expect(Message.create).not.toHaveBeenCalled();
        expect(stored.filter((e) => e.event?.type === 'thread_linked')).toHaveLength(2);
    });

    test('the discussion shows the thread\'s latest replies to people in the conversation only', async () => {
        task.linkedMessage = REPLY;
        Message.find.mockImplementation(() => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: oid(203), sender: WATCHER, createdAt: 3 }, { _id: oid(202), sender: ASSIGNEE, createdAt: 2 }] }) }) }));
        checkConversationAccess.mockResolvedValueOnce({ ok: true });
        const linked = await discussion.linkedThreadFor(task, ASSIGNEE);
        expect(linked).toMatchObject({ messageId: ROOT, sourceMessageId: REPLY, channelId: CHANNEL, channelName: 'launch', replyCount: 2, locked: false });
        expect(linked.latestReplies.map((r) => r._id)).toEqual([oid(202), oid(203)]);
        expect(linked.parent.payload).toEqual({ ciphertext: 'root', messageIv: 'iv' });

        checkConversationAccess.mockResolvedValueOnce({ ok: false, status: 404 });
        expect(await discussion.linkedThreadFor(task, OUTSIDER)).toEqual({ messageId: ROOT, sourceMessageId: REPLY, restricted: true });
    });

    test('a group member who joined after the thread started sees it as restricted', async () => {
        task.linkedMessage = ROOT;
        messages[ROOT].createdAt = new Date('2026-04-01');
        checkConversationAccess.mockResolvedValueOnce({ ok: true, since: new Date('2026-05-01') });
        expect(await discussion.linkedThreadFor(task, ASSIGNEE)).toEqual({ messageId: ROOT, sourceMessageId: ROOT, restricted: true });
    });
});
