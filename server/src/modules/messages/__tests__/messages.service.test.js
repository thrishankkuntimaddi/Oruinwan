const messagesService = require('../messages.service');
const Message = require('../../../features/messages/message.model.js');
const DMSession = require('../../../../models/DMSession');
const Workspace = require('../../../../models/Workspace');

jest.mock('../../../features/messages/message.model.js');
jest.mock('../../../../models/DMSession');
jest.mock('../../../../models/Workspace');

jest.mock('../../conversations/conversationKeys.service', () => ({
    bootstrapConversationKey: jest.fn().mockResolvedValue({ success: true }),
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

            expect(mockIo.to).toHaveBeenCalledWith('channel:ch123');
            expect(mockIo.emit).toHaveBeenCalledWith('new-message', expect.anything());
        });
    });

    describe('findOrCreateDMSession', () => {
        it('should return existing DM session if found', async () => {
            const mockSession = {
                _id: 'dm123',
                participants: ['user1', 'user2'],
                lastMessageAt: new Date(),
                save: jest.fn()
            };

            DMSession.findOne = jest.fn().mockResolvedValue(mockSession);

            const result = await messagesService.findOrCreateDMSession(
                'user1',
                'user2',
                'ws123'
            );

            expect(DMSession.findOne).toHaveBeenCalled();
            expect(result._id).toBe('dm123');
            expect(mockSession.save).toHaveBeenCalled();
        });

        it('should create new DM session if not found', async () => {
            const mockWorkspace = { _id: 'ws123', company: 'comp123' };
            const mockNewSession = { _id: 'dm456', participants: ['user1', 'user2'] };

            DMSession.findOne = jest.fn().mockResolvedValue(null);
            Workspace.findById = jest.fn().mockResolvedValue(mockWorkspace);
            
            DMSession.findOneAndUpdate = jest.fn().mockResolvedValue(mockNewSession);

            const result = await messagesService.findOrCreateDMSession('user1', 'user2', 'ws123');

            expect(DMSession.findOneAndUpdate).toHaveBeenCalled();
            expect(result._id).toBe('dm456');
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
                    
                    if (populateCallCount < 4) return mockQuery;
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
});
