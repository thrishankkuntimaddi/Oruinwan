const messagesService = require('../messages.service');
const Message = require('../message.model.js');
const DMSession = require('../../../../models/DMSession');
// Users and workspaces live in PostgreSQL: the identity repositories are mocked.
const identity = require('../../../identity');

// Key versions (conversations/keyEpochs) live in PostgreSQL; here every conversation is on its first key.
jest.mock('../../conversations/keyEpochs', () => ({ checkSendVersion: jest.fn(async (_id, _type, v) => (v == null ? 1 : Number(v))) }));
jest.mock('../message.model.js');
jest.mock('../../threads/threadAccess', () => ({
    checkConversationAccess: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../../../../models/DMSession');
jest.mock('../../conversations/conversationAccess', () => ({
    ...jest.requireActual('../../conversations/conversationAccess'),
    checkMessageAccess: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../../../identity', () => ({
    workspaces: { findById: jest.fn() },
    users: { findById: jest.fn(), findManyByIds: jest.fn(async (ids) => new Map(ids.map(id => [String(id), { _id: String(id), username: 'u' + id }]))) },
}));

jest.mock('../messageAccess', () => ({
    canAccessMessage: jest.fn().mockResolvedValue(true),
    loadAccessibleMessage: jest.fn(async (Model, id) => {
        const q = Model.findById(id);
        const r = q && q.select ? q.select() : q;
        return r && r.lean ? r.lean() : r;
    }),
}));

// After a send, createMessage fans out in the background and looks up the channel. With no
// database that query would buffer for 10 s and outlive this file, which Jest reports as a
// failed run ("import after the environment has been torn down") even when every test passes.
jest.mock('../../../features/channels/channel.model.js', () => ({
    findById: jest.fn(() => ({ select: () => ({ lean: async () => null }) })),
}));

jest.mock('../../conversations/conversationKeys.service', () => ({
    bootstrapConversationKey: jest.fn().mockResolvedValue({ success: true }),
    ensureDMConversationKey: jest.fn().mockResolvedValue({ status: "OK" }),
}));

describe('Messages Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createMessage', () => {
        it('should reject an unencrypted text message (E2EE enforced)', async () => {
            await expect(
                messagesService.createMessage({
                    type: 'message',
                    sender: 'user123',
                    text: 'Hello world',        
                    workspace: 'ws123',
                    channel: 'ch123'
                })
            ).rejects.toThrow('E2EE required');
        });

        it('should create an encrypted message with E2EE fields', async () => {
            const mockMessage = {
                _id: 'msg123',
                type: 'message',
                sender: 'user123',
                payload: { ciphertext: 'encrypted-data', isEncrypted: true, messageIv: 'iv-data' },
                populate: jest.fn().mockResolvedValue({
                    _id: 'msg123',
                    sender: { username: 'testuser' }
                })
            };

            Message.create = jest.fn().mockResolvedValue(mockMessage);

            const result = await messagesService.createMessage({
                type: 'message',
                sender: 'user123',
                ciphertext: 'encrypted-data',
                messageIv: 'iv-data',
                isEncrypted: true,
                workspace: 'ws123',
                channel: 'ch123'
            });

            
            expect(Message.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        ciphertext: 'encrypted-data',
                        isEncrypted: true,
                        messageIv: 'iv-data',
                    })
                })
            );
        });

        it('should emit socket event when io is provided', async () => {
            const mockIo = {
                to: jest.fn().mockReturnThis(),
                emit: jest.fn()
            };

            const mockMessage = {
                _id: 'msg123',
                channel: 'ch123',
                toObject: jest.fn().mockReturnValue({ _id: 'msg123', sender: {} }),
                populate: jest.fn().mockResolvedValue({ _id: 'msg123', sender: {} })
            };

            Message.create = jest.fn().mockResolvedValue(mockMessage);

            await messagesService.createMessage(
                {
                    type: 'message',
                    sender: 'user123',
                    ciphertext: 'enc',
                    messageIv: 'iv',
                    isEncrypted: true,
                    workspace: 'ws123',
                    channel: 'ch123'
                },
                mockIo
            );

            expect(mockIo.to).toHaveBeenCalledWith(['channel:ch123']);
            expect(mockIo.emit).toHaveBeenCalledWith('new-message', expect.anything());
        });
    });

    describe('findOrCreateDMSession', () => {
        const U1 = 'a'.repeat(24);
        const U2 = 'b'.repeat(24);
        const WS = 'c'.repeat(24);
        const KEY = `${WS}:${U1}:${U2}`;
        const sortable = (v) => ({ sort: jest.fn().mockResolvedValue(v), then: (res, rej) => Promise.resolve(v).then(res, rej) });
        const workspace = (members) => ({ _id: WS, company: null, members: members.map(([user, status]) => ({ user, status })) });

        beforeEach(() => {
            DMSession.dmPairKey = (w, a, b) => `${w}:${[String(a), String(b)].sort().join(':')}`;
            DMSession.updateOne = jest.fn().mockResolvedValue({});
        });

        it('returns the existing DM of the pair', async () => {
            identity.workspaces.findById.mockResolvedValue(workspace([[U1, 'active'], [U2, 'active']]));
            DMSession.findOne = jest.fn().mockReturnValueOnce(sortable({ _id: 'dm123', pairKey: KEY, participants: [U1, U2] }));
            const result = await messagesService.findOrCreateDMSession(U2, U1, WS);
            expect(DMSession.findOne).toHaveBeenCalledWith({ pairKey: KEY });
            expect(result._id).toBe('dm123');
        });

        it('finds a DM from before pair keys and gives it the key', async () => {
            identity.workspaces.findById.mockResolvedValue(workspace([[U1, 'active'], [U2, 'active']]));
            DMSession.findOne = jest.fn()
                .mockReturnValueOnce(sortable(null))
                .mockReturnValueOnce(sortable({ _id: 'dmOld', participants: [U1, U2] }));
            const result = await messagesService.findOrCreateDMSession(U1, U2, WS);
            expect(result._id).toBe('dmOld');
            expect(DMSession.updateOne).toHaveBeenCalledWith({ _id: 'dmOld' }, { $set: { pairKey: KEY } });
        });

        it('creates one DM per pair with an upsert on the pair key', async () => {
            identity.workspaces.findById.mockResolvedValue(workspace([[U1, 'active'], [U2, 'active']]));
            DMSession.findOne = jest.fn().mockReturnValue(sortable(null));
            DMSession.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: 'dm456', participants: [U1, U2] });
            const result = await messagesService.findOrCreateDMSession(U1, U2, WS);
            expect(DMSession.findOneAndUpdate).toHaveBeenCalledWith(
                { pairKey: KEY },
                { $setOnInsert: expect.objectContaining({ pairKey: KEY, participants: [U1, U2], isGroup: false }) },
                { upsert: true, new: true },
            );
            expect(result._id).toBe('dm456');
        });

        it('returns the DM the other request made when both open it at once', async () => {
            identity.workspaces.findById.mockResolvedValue(workspace([[U1, 'active'], [U2, 'active']]));
            DMSession.findOne = jest.fn()
                .mockReturnValueOnce(sortable(null))
                .mockReturnValueOnce(sortable(null))
                .mockReturnValueOnce(sortable({ _id: 'dmRace', pairKey: KEY }));
            DMSession.findOneAndUpdate = jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
            const result = await messagesService.findOrCreateDMSession(U1, U2, WS);
            expect(result._id).toBe('dmRace');
        });

        it('refuses people who are not active members of the workspace', async () => {
            identity.workspaces.findById.mockResolvedValue(workspace([[U1, 'active'], [U2, 'removed']]));
            DMSession.findOne = jest.fn();
            await expect(messagesService.findOrCreateDMSession(U1, U2, WS)).rejects.toMatchObject({ status: 403 });
            identity.workspaces.findById.mockResolvedValue(workspace([[U2, 'active']]));
            await expect(messagesService.findOrCreateDMSession(U1, U2, WS)).rejects.toMatchObject({ status: 403 });
            expect(DMSession.findOne).not.toHaveBeenCalled();
        });

        it('refuses invalid ids and a DM with yourself', async () => {
            await expect(messagesService.findOrCreateDMSession('x', U2, WS)).rejects.toMatchObject({ status: 400 });
            await expect(messagesService.findOrCreateDMSession(U1, U1, WS)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('fetchMessages', () => {
        it('should fetch messages with pagination', async () => {
            const rawMessages = [
                { _id: 'msg1', text: 'Hello', toObject: () => ({ _id: 'msg1', text: 'Hello' }) },
                { _id: 'msg2', text: 'World', toObject: () => ({ _id: 'msg2', text: 'World' }) },
            ];

            
            
            let populateCallCount = 0;
            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockImplementation(() => {
                    populateCallCount++;
                    
                    // populate('parentId').populate('quotedMessageId'); users are hydrated afterwards.
                    if (populateCallCount < 2) return mockQuery;
                    return Promise.resolve([...rawMessages]);
                }),
            };

            Message.find = jest.fn().mockReturnValue(mockQuery);
            Message.countDocuments = jest.fn().mockResolvedValue(10);
            
            Message.aggregate = jest.fn().mockResolvedValue([]);

            const result = await messagesService.fetchMessages(
                { channel: 'ch123' },
                { limit: 2 }
            );

            expect(result.messages).toHaveLength(2);
            expect(result.hasMore).toBe(false); 
        });
    });

    describe('checklistToggle', () => {
        it('refuses users outside the conversation', async () => {
            const { checkMessageAccess } = require('../../conversations/conversationAccess');
            checkMessageAccess.mockResolvedValueOnce({ ok: false, status: 404, error: 'Message not found' });
            Message.findById = jest.fn().mockResolvedValue({ _id: 'msg1', type: 'checklist', channel: 'ch1', checklist: [{ checked: false }], save: jest.fn(), markModified: jest.fn() });
            await expect(messagesService.checklistToggle('msg1', 0, 'intruder', null)).rejects.toMatchObject({ status: 404 });
            // Message-level: in a group, a checklist from before you joined is out of reach too.
            expect(checkMessageAccess).toHaveBeenCalledWith(expect.objectContaining({ _id: 'msg1' }), 'intruder', { forWrite: true });
        });

        it('should throw if message type is not checklist', async () => {
            const mockMsg = {
                _id: 'msg1',
                type: 'message',
                checklist: [],
                channel: 'ch1',
                save: jest.fn(),
                markModified: jest.fn(),
            };
            Message.findById = jest.fn().mockResolvedValue(mockMsg);

            await expect(
                messagesService.checklistToggle('msg1', 0, 'user1', null)
            ).rejects.toThrow('Message is not a checklist');
        });

        it('should toggle a checklist item and return updated list', async () => {
            const mockMsg = {
                _id: 'msg1',
                type: 'checklist',
                channel: 'ch1',
                checklist: [
                    { text: 'Task A', checked: false, checkedBy: null, checkedAt: null }
                ],
                save: jest.fn().mockResolvedValue(true),
                markModified: jest.fn(),
            };
            Message.findById = jest.fn().mockResolvedValue(mockMsg);

            const result = await messagesService.checklistToggle('msg1', 0, 'user1', null);

            expect(mockMsg.checklist[0].checked).toBe(true);
            expect(mockMsg.save).toHaveBeenCalled();
            expect(result).toEqual(mockMsg.checklist);
        });
    });

    describe('getMessageDiff', () => {
        it('should return editHistory and currentText', async () => {
            const mockMsg = {
                _id: 'msg1',
                text: 'Current text',
                version: 3,
                editedAt: new Date('2024-01-01'),
                editHistory: [
                    { text: 'Original', editedAt: new Date('2023-12-01'), isEncrypted: false },
                    { text: 'First edit', editedAt: new Date('2023-12-15'), isEncrypted: false },
                ],
            };
            Message.findById = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockMsg)
                })
            });

            const result = await messagesService.getMessageDiff('msg1', 'user1');

            expect(result.currentText).toBe('Current text');
            expect(result.editHistory).toHaveLength(2);
            expect(result.version).toBe(3);
        });
    });

    describe('fetchMessages around an anchor ("Go to message")', () => {
        const CH = 'a'.repeat(24);
        const ANCHOR = 'b'.repeat(24);

        it('only anchors on a message of the same conversation the reader can see', async () => {
            const populate = jest.fn();
            const chain = { populate };
            populate.mockReturnValue(chain);
            chain.then = (r) => Promise.resolve(null).then(r);
            Message.findOne = jest.fn(() => chain);
            const joined = new Date('2026-01-01T00:00:00Z');
            const out = await messagesService.fetchMessages({ channel: CH }, { around: ANCHOR, userId: 'u1', userJoinedAt: joined });
            expect(Message.findOne).toHaveBeenCalledWith(expect.objectContaining({ channel: CH, parentId: null, _id: ANCHOR, createdAt: { $gte: joined } }));
            expect(out).toEqual({ messages: [], hasMore: false, hasMoreNewer: false });
        });

        it('ignores a malformed anchor id', async () => {
            Message.findOne = jest.fn();
            const out = await messagesService.fetchMessages({ channel: CH }, { around: 'nope' });
            expect(Message.findOne).not.toHaveBeenCalled();
            expect(out.messages).toEqual([]);
        });
    });
});
