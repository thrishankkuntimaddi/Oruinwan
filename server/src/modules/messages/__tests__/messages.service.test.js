// server/src/modules/messages/__tests__/messages.service.test.js
/**
 * Messages Service - Unit Tests
 * 
 * Tests for message creation, retrieval, and DM session management
 */

const messagesService = require('../messages.service');
const Message = require("../../../features/messages/message.model.js");
const DMSession = require('../../../../models/DMSession');
const Workspace = require('../../../../models/Workspace');

// Mock dependencies
jest.mock('../../../../models/Message');
jest.mock('../../../../models/DMSession');
jest.mock('../../../../models/Workspace');

describe('Messages Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createMessage', () => {
        it('should create an unencrypted message', async () => {
            const mockMessage = {
                _id: 'msg123',
                type: 'message',
                sender: 'user123',
                payload: { text: 'Hello world', attachments: [] },
                isEncrypted: false,
                populate: jest.fn().mockResolvedValue({
                    _id: 'msg123',
                    sender: { username: 'testuser' }
                })
            };

            Message.create = jest.fn().mockResolvedValue(mockMessage);

            const result = await messagesService.createMessage({
                type: 'message',
                sender: 'user123',
                text: 'Hello world',
                workspace: 'ws123',
                channel: 'ch123'
            });

            expect(Message.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    isEncrypted: false,
                    payload: { text: 'Hello world', attachments: [] }
                })
            );
            expect(result.sender.username).toBe('testuser');
        });

        it('should create an encrypted message with E2EE fields', async () => {
            const mockMessage = {
                _id: 'msg123',
                type: 'message',
                sender: 'user123',
                ciphertext: 'encrypted-data',
                messageIv: 'iv-data',
                isEncrypted: true,
                encryptionVersion: 'aes-256-gcm-v1',
                payload: { text: '', attachments: [] },
                populate: jest.fn().mockResolvedValue({
                    _id: 'msg123',
                    sender: { username: 'testuser' }
                })
            };

            Message.create = jest.fn().mockResolvedValue(mockMessage);

            const _result = await messagesService.createMessage({
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
                    isEncrypted: true,
                    ciphertext: 'encrypted-data',
                    messageIv: 'iv-data',
                    encryptionVersion: 'aes-256-gcm-v1',
                    payload: { text: '', attachments: [] }
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
                populate: jest.fn().mockResolvedValue({ _id: 'msg123' })
            };

            Message.create = jest.fn().mockResolvedValue(mockMessage);

            await messagesService.createMessage(
                {
                    type: 'message',
                    sender: 'user123',
                    text: 'Hello',
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
            const mockWorkspace = {
                _id: 'ws123',
                company: 'comp123'
            };

            const mockNewSession = {
                _id: 'dm456',
                participants: ['user1', 'user2']
            };

            DMSession.findOne = jest.fn().mockResolvedValue(null);
            Workspace.findById = jest.fn().mockResolvedValue(mockWorkspace);
            DMSession.create = jest.fn().mockResolvedValue(mockNewSession);

            const result = await messagesService.findOrCreateDMSession(
                'user1',
                'user2',
                'ws123'
            );

            expect(DMSession.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspace: 'ws123',
                    company: 'comp123',
                    participants: ['user1', 'user2']
                })
            );
            expect(result._id).toBe('dm456');
        });
    });

    describe('fetchMessages', () => {
        it('should fetch messages with pagination', async () => {
            const mockMessages = [
                { _id: 'msg1', text: 'Hello' },
                { _id: 'msg2', text: 'World' }
            ];

            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis()
            };

            Message.find = jest.fn().mockReturnValue(mockQuery);
            mockQuery.populate.mockResolvedValue(mockMessages);
            Message.countDocuments = jest.fn().mockResolvedValue(10);

            const result = await messagesService.fetchMessages(
                { channel: 'ch123' },
                { limit: 2 }
            );

            expect(result.messages).toHaveLength(2);
            expect(result.hasMore).toBe(true);
            expect(result.total).toBe(10);
        });
    });
});
