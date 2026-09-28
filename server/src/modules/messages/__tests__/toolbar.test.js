'use strict';

/**
 * Message toolbar endpoints: access control, version history/restore and
 * convert-to-task. Models are mocked; messageAccess runs for real against the
 * mocked Channel / DMSession / Workspace models.
 */

const Message = require('../message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const Workspace = require('../../../../models/Workspace');
const Task = require('../../../../models/Task');
const User = require('../../../../models/User');
const TaskActivity = require('../../../../models/TaskActivity');
const IssueKeyCounter = require('../../../features/tasks/issue-key-counter.model');

jest.mock('../message.model.js');
jest.mock('../../../../models/User');
jest.mock('../../../../models/TaskActivity');
jest.mock('../../../features/tasks/issue-key-counter.model');
jest.mock('../../../features/channels/channel.model.js');
jest.mock('../../../../models/DMSession');
jest.mock('../../../../models/Workspace');
jest.mock('../../../../models/Task');
jest.mock('../../conversations/conversationKeys.service', () => ({
    bootstrapConversationKey: jest.fn().mockResolvedValue({ success: true }),
    ensureDMConversationKey: jest.fn().mockResolvedValue({ status: "OK" }),
}));

const messagesService = require('../messages.service');
const { canAccessMessage } = require('../messageAccess');

const oid = (n) => n.toString(16).padStart(24, '0');
const SENDER = oid(1);
const OTHER = oid(2);
const OUTSIDER = oid(3);
const MSG = oid(10);
const CH = oid(20);
const WS = oid(30);
const OTHER_WS = oid(31);

/** Mongoose-ish chainable query resolving to `value`. */
function query(value) {
    const q = {
        select: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => q),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

function privateChannel(memberIds) {
    return { _id: CH, isPrivate: true, isDefault: false, workspace: WS, members: memberIds.map(u => ({ user: u })) };
}

function makeDoc(overrides = {}) {
    const doc = {
        _id: MSG,
        sender: { _id: SENDER, username: 'alice' },
        channel: CH,
        dm: null,
        workspace: WS,
        payload: { ciphertext: 'Y3VycmVudA==', messageIv: 'aXYz', isEncrypted: true },
        text: '',
        editHistory: [
            { text: null, ciphertext: 'b3JpZ2luYWw=', messageIv: 'aXYx', isEncrypted: true, editedAt: new Date('2026-01-01') },
            { text: null, ciphertext: 'ZWRpdDE=', messageIv: 'aXYy', isEncrypted: true, editedAt: new Date('2026-01-02') },
        ],
        editedAt: new Date('2026-01-03'),
        createdAt: new Date('2026-01-01'),
        version: 3,
        restoredFromVersion: null,
        isDeleted: false,
        isDeletedUniversally: false,
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
    };
    doc.toObject = jest.fn(() => ({ ...doc }));
    return doc;
}

describe('message toolbar', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Channel.findById = jest.fn(() => query(privateChannel([SENDER, OTHER])));
        Workspace.findOne = jest.fn(() => query(null));
        DMSession.findById = jest.fn(() => query(null));
    });

    describe('canAccessMessage', () => {
        it('allows channel members and denies outsiders of a private channel', async () => {
            expect(await canAccessMessage({ channel: CH }, OTHER)).toBe(true);
            expect(await canAccessMessage({ channel: CH }, OUTSIDER)).toBe(false);
        });

        it('requires workspace membership for public channels', async () => {
            Channel.findById = jest.fn(() => query({ _id: CH, isPrivate: false, workspace: WS, members: [] }));
            Workspace.findOne = jest.fn(() => query(null));
            expect(await canAccessMessage({ channel: CH }, OUTSIDER)).toBe(false);
            Workspace.findOne = jest.fn(() => query({ _id: WS }));
            expect(await canAccessMessage({ channel: CH }, OUTSIDER)).toBe(true);
        });

        it('checks DM participants', async () => {
            DMSession.findById = jest.fn(() => query({ participants: [SENDER, OTHER] }));
            expect(await canAccessMessage({ dm: oid(40) }, OTHER)).toBe(true);
            expect(await canAccessMessage({ dm: oid(40) }, OUTSIDER)).toBe(false);
        });
    });

    describe('restoreMessageVersion', () => {
        it('rejects a non-sender with 403 and does not save', async () => {
            const doc = makeDoc();
            Message.findById = jest.fn(() => query(doc));
            await expect(messagesService.restoreMessageVersion(MSG, OTHER, 0, null))
                .rejects.toMatchObject({ status: 403 });
            expect(doc.save).not.toHaveBeenCalled();
        });

        it('rejects an invalid index and a deleted message with 400', async () => {
            Message.findById = jest.fn(() => query(makeDoc()));
            await expect(messagesService.restoreMessageVersion(MSG, SENDER, 5, null)).rejects.toMatchObject({ status: 400 });
            Message.findById = jest.fn(() => query(makeDoc({ isDeleted: true })));
            await expect(messagesService.restoreMessageVersion(MSG, SENDER, 0, null)).rejects.toMatchObject({ status: 400 });
        });

        it('pushes the current content into history, restores the chosen version and emits message:edited', async () => {
            const doc = makeDoc();
            Message.findById = jest.fn(() => query(doc));
            const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

            await messagesService.restoreMessageVersion(MSG, SENDER, 0, io);

            expect(doc.editHistory).toHaveLength(3);
            expect(doc.editHistory[2]).toMatchObject({ ciphertext: 'Y3VycmVudA==', messageIv: 'aXYz', isEncrypted: true });
            expect(doc.payload).toMatchObject({ ciphertext: 'b3JpZ2luYWw=', messageIv: 'aXYx', isEncrypted: true });
            expect(doc.restoredFromVersion).toBe(1);
            expect(doc.version).toBe(4);
            expect(doc.save).toHaveBeenCalled();
            expect(io.to).toHaveBeenCalledWith(`channel:${CH}`);
            expect(io.emit).toHaveBeenCalledWith('message:edited', expect.objectContaining({ _id: MSG, restoredFromVersion: 1 }));
        });
    });

    describe('editMessage', () => {
        it('rejects empty and identical edits, and clears restoredFromVersion on a normal edit', async () => {
            await expect(messagesService.editMessage(MSG, SENDER, {}, null)).rejects.toMatchObject({ status: 400 });

            Message.findById = jest.fn(() => query(makeDoc()));
            await expect(messagesService.editMessage(MSG, SENDER, { ciphertext: 'Y3VycmVudA==', messageIv: 'bmV3' }, null))
                .rejects.toMatchObject({ status: 400 });

            const doc = makeDoc({ restoredFromVersion: 1 });
            Message.findById = jest.fn(() => query(doc));
            await messagesService.editMessage(MSG, SENDER, { ciphertext: 'bmV3', messageIv: 'aXY0' }, null);
            expect(doc.restoredFromVersion).toBeNull();
            expect(doc.editHistory[2]).toMatchObject({ ciphertext: 'Y3VycmVudA==', restoredFromVersion: 1 });
        });
    });

    describe('getMessageVersions', () => {
        it('denies non-members with 403', async () => {
            Message.findById = jest.fn(() => query(makeDoc()));
            await expect(messagesService.getMessageVersions(MSG, OUTSIDER)).rejects.toMatchObject({ status: 403 });
        });

        it('returns versions oldest→newest with ciphertext and canRestore for the sender only', async () => {
            Message.findById = jest.fn(() => query(makeDoc()));
            const asSender = await messagesService.getMessageVersions(MSG, SENDER);
            expect(asSender.canRestore).toBe(true);
            expect(asSender.current).toMatchObject({ version: 3, ciphertext: 'Y3VycmVudA==', messageIv: 'aXYz' });
            expect(asSender.versions.map(v => [v.index, v.version])).toEqual([[0, 1], [1, 2]]);
            expect(asSender.versions[0]).toMatchObject({ ciphertext: 'b3JpZ2luYWw=', restoredFromVersion: null });

            const asMember = await messagesService.getMessageVersions(MSG, OTHER);
            expect(asMember.canRestore).toBe(false);
        });
    });

    describe('convertToTask', () => {
        function mockTaskDeps({ companyId = oid(51), wsCompany = null } = {}) {
            Workspace.findById = jest.fn(() => query({
                _id: WS, name: 'Acme', company: wsCompany,
                members: [{ user: SENDER, status: 'active' }, { user: OTHER, status: 'active' }],
            }));
            User.findById = jest.fn(() => query({ _id: OTHER, companyId, username: 'bob' }));
            IssueKeyCounter.nextKey = jest.fn().mockResolvedValue('ACME-7');
            TaskActivity.create = jest.fn().mockResolvedValue({});
            Task.findById = jest.fn(() => query(null));
        }

        it('ignores a client-supplied workspaceId and links the task to the message', async () => {
            Message.findById = jest.fn(() => query(makeDoc({ company: oid(50), linkedTaskId: null })));
            Message.findByIdAndUpdate = jest.fn().mockResolvedValue({});
            Task.create = jest.fn(async (data) => ({ _id: oid(60), ...data }));
            mockTaskDeps({ companyId: oid(50) });

            const task = await messagesService.convertToTask(
                MSG, OTHER, { title: 'Ship it', workspaceId: OTHER_WS, priority: 'high' }, null
            );

            expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Ship it',
                workspace: WS,
                company: oid(50),
                priority: 'high',
                linkedMessage: MSG,
                assignedTo: [OTHER],
            }));
            expect(String(task.workspace)).toBe(WS);
            expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(MSG, { $set: { linkedTaskId: oid(60) } });
        });

        it('gives the task the message channel, an issue key, a created activity and emits task-created', async () => {
            Message.findById = jest.fn(() => query(makeDoc({ company: oid(50), linkedTaskId: null })));
            Message.findByIdAndUpdate = jest.fn().mockResolvedValue({});
            Task.create = jest.fn(async (data) => ({ _id: oid(60), ...data }));
            mockTaskDeps({ companyId: oid(52), wsCompany: oid(53) });
            const emit = jest.fn();
            const io = { to: jest.fn(() => ({ emit })) };

            await messagesService.convertToTask(MSG, OTHER, { title: 'Ship it', assigneeIds: [SENDER] }, io);

            expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({
                channel: CH,
                issueKey: 'ACME-7',
                company: oid(53), // workspace company, same rule as the Tasks page
                assignedTo: [SENDER],
            }));
            expect(TaskActivity.create).toHaveBeenCalledWith(expect.objectContaining({ task: oid(60), action: 'created', user: OTHER }));
            const rooms = io.to.mock.calls.map(c => c[0]);
            expect(rooms).toContainEqual(expect.arrayContaining([`user_${OTHER}`, `user_${SENDER}`]));
            expect(emit).toHaveBeenCalledWith('task-created', expect.anything());
        });

        it('creates DM tasks without a channel', async () => {
            Message.findById = jest.fn(() => query(makeDoc({ channel: null, dm: oid(70), workspace: null, linkedTaskId: null })));
            DMSession.findById = jest.fn(() => query({ _id: oid(70), participants: [SENDER, OTHER] }));
            Message.findByIdAndUpdate = jest.fn().mockResolvedValue({});
            Task.create = jest.fn(async (data) => ({ _id: oid(61), ...data }));
            mockTaskDeps();

            await messagesService.convertToTask(MSG, OTHER, { title: 'DM task' }, null);
            expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({ channel: null, workspace: null, taskType: 'personal' }));
        });

        it('requires a title and rejects non-workspace assignees', async () => {
            await expect(messagesService.convertToTask(MSG, OTHER, {}, null)).rejects.toMatchObject({ status: 400 });

            Message.findById = jest.fn(() => query(makeDoc({ linkedTaskId: null })));
            Workspace.findById = jest.fn(() => query({ _id: WS, members: [{ user: OTHER, status: 'active' }] }));
            await expect(messagesService.convertToTask(MSG, OTHER, { title: 't', assigneeIds: [OUTSIDER] }, null))
                .rejects.toMatchObject({ status: 400 });
        });

        it('denies users without access', async () => {
            Message.findById = jest.fn(() => query(makeDoc({ linkedTaskId: null })));
            await expect(messagesService.convertToTask(MSG, OUTSIDER, { title: 't' }, null)).rejects.toMatchObject({ status: 403 });
        });
    });

    describe('toggleBookmark', () => {
        it('toggles on and off for members and 403s outsiders', async () => {
            Message.updateOne = jest.fn().mockResolvedValue({});
            Message.findById = jest.fn(() => query(makeDoc({ bookmarkedBy: [] })));
            expect(await messagesService.toggleBookmark(MSG, OTHER)).toEqual({ bookmarked: true, messageId: MSG });
            Message.findById = jest.fn(() => query(makeDoc({ bookmarkedBy: [OTHER] })));
            expect(await messagesService.toggleBookmark(MSG, OTHER)).toEqual({ bookmarked: false, messageId: MSG });
            await expect(messagesService.toggleBookmark(MSG, OUTSIDER)).rejects.toMatchObject({ status: 403 });
        });
    });

    describe('normalizePriority', () => {
        it('maps to the Task enum', () => {
            expect(messagesService.normalizePriority('HIGH')).toBe('high');
            expect(messagesService.normalizePriority('urgent')).toBe('highest');
            expect(messagesService.normalizePriority('bogus')).toBe('medium');
        });
    });

    describe('AI translate', () => {
        const aiMessaging = require('../../ai/ai-messaging.service');
        const gateway = require('../../../../../ai/api/ai.gateway');
        const { Orchestrator } = require('../../../../../ai/orchestrator');
        const { MockProvider } = require('../../../../../ai/providers');

        it('parses fenced JSON, plain JSON and raw text replies', () => {
            expect(aiMessaging.parseTranslation('```json\n{"translated":"Hola","detectedLang":"en"}\n```'))
                .toEqual({ translated: 'Hola', detectedLang: 'en' });
            expect(aiMessaging.parseTranslation('{"translated":"Bonjour"}')).toEqual({ translated: 'Bonjour', detectedLang: null });
            expect(aiMessaging.parseTranslation('Ciao')).toEqual({ translated: 'Ciao', detectedLang: null });
        });

        it('goes through the gateway provider and returns { translated, detectedLang }', async () => {
            const provider = new MockProvider(() => '{"translated":"Hallo Welt","detectedLang":"en"}');
            gateway.setOrchestrator(new Orchestrator({ provider }));
            const out = await aiMessaging.translateMessage(`Hello world ${Date.now()}`, 'German');
            expect(out).toEqual({ translated: 'Hallo Welt', detectedLang: 'en' });
            expect(provider.calls[0].kind).toBe('text');
            gateway.setOrchestrator(null);
        });
    });
});
