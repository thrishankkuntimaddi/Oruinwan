// server/src/modules/encryption/__tests__/encryption.service.test.js
/**
 * Encryption Service - Unit Tests
 * 
 * Tests for E2EE key management and encryption operations
 */

const encryptionService = require('../encryption.service');
const { UserWorkspaceKey, WorkspaceKey } = require('../../../../models/encryption');

// Mock dependencies
jest.mock('../../../../models/encryption');

describe('Encryption Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateWorkspaceKey', () => {
        it('should generate a 32-byte key', () => {
            const key = encryptionService.generateWorkspaceKey();
            expect(key).toBeInstanceOf(Buffer);
            expect(key.length).toBe(32);
        });
    });

    describe('generateIV', () => {
        it('should generate a 12-byte IV', () => {
            const iv = encryptionService.generateIV();
            expect(iv).toBeInstanceOf(Buffer);
            expect(iv.length).toBe(12);
        });
    });

    describe('generateSalt', () => {
        it('should generate a 16-byte salt', () => {
            const salt = encryptionService.generateSalt();
            expect(salt).toBeInstanceOf(Buffer);
            expect(salt.length).toBe(16);
        });
    });

    describe('enrollUserInWorkspace', () => {
        it('should create encrypted workspace key for user', async () => {
            const workspaceKey = Buffer.from('a'.repeat(32));
            const userKEK = Buffer.from('b'.repeat(32));
            const userSalt = Buffer.from('c'.repeat(16));

            const mockUserKey = {
                _id: 'key123',
                userId: 'user123',
                workspaceId: 'ws123'
            };

            UserWorkspaceKey.create = jest.fn().mockResolvedValue(mockUserKey);

            const result = await encryptionService.enrollUserInWorkspace(
                'user123',
                'ws123',
                workspaceKey,
                userKEK,
                userSalt
            );

            expect(UserWorkspaceKey.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user123',
                    workspaceId: 'ws123',
                    encryptedKey: expect.any(String),
                    keyIv: expect.any(String),
                    pbkdf2Salt: expect.any(String),
                    pbkdf2Iterations: 100000
                })
            );
            expect(result._id).toBe('key123');
        });
    });

    describe('revokeUserAccess', () => {
        it('should delete user workspace key', async () => {
            UserWorkspaceKey.deleteOne = jest.fn().mockResolvedValue({
                deletedCount: 1
            });

            const result = await encryptionService.revokeUserAccess('user123', 'ws123');

            expect(UserWorkspaceKey.deleteOne).toHaveBeenCalledWith({
                userId: 'user123',
                workspaceId: 'ws123'
            });
            expect(result).toBe(true);
        });

        it('should return false if no key found', async () => {
            UserWorkspaceKey.deleteOne = jest.fn().mockResolvedValue({
                deletedCount: 0
            });

            const result = await encryptionService.revokeUserAccess('user123', 'ws123');
            expect(result).toBe(false);
        });
    });

    describe('getUserWorkspaceKeys', () => {
        it('should return all workspace keys for user', async () => {
            const mockKeys = [
                { _id: 'key1', workspaceId: 'ws1' },
                { _id: 'key2', workspaceId: 'ws2' }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockKeys)
            };

            UserWorkspaceKey.find = jest.fn().mockReturnValue(mockQuery);

            const result = await encryptionService.getUserWorkspaceKeys('user123');

            expect(UserWorkspaceKey.find).toHaveBeenCalledWith({ userId: 'user123' });
            expect(result).toHaveLength(2);
        });
    });

    describe('createWorkspaceKey', () => {
        it('should create new workspace encryption key', async () => {
            const creatorKEK = Buffer.from('a'.repeat(32));

            const mockWorkspaceKey = {
                _id: 'wk123',
                workspaceId: 'ws123',
                createdBy: 'user123'
            };

            WorkspaceKey.create = jest.fn().mockResolvedValue(mockWorkspaceKey);

            const result = await encryptionService.createWorkspaceKey(
                'ws123',
                'user123',
                creatorKEK
            );

            expect(WorkspaceKey.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: 'ws123',
                    encryptedMasterKey: expect.any(String),
                    masterKeyIv: expect.any(String),
                    createdBy: 'user123',
                    isActive: true
                })
            );
            expect(result.workspaceKey).toBeInstanceOf(Buffer);
            expect(result.workspaceKey.length).toBe(32);
            expect(result.workspaceKeyDoc._id).toBe('wk123');
        });
    });

    describe('userHasWorkspaceAccess', () => {
        it('should return true if user has access', async () => {
            UserWorkspaceKey.findOne = jest.fn().mockResolvedValue({ _id: 'key123' });

            const result = await encryptionService.userHasWorkspaceAccess('user123', 'ws123');
            expect(result).toBe(true);
        });

        it('should return false if user has no access', async () => {
            UserWorkspaceKey.findOne = jest.fn().mockResolvedValue(null);

            const result = await encryptionService.userHasWorkspaceAccess('user123', 'ws123');
            expect(result).toBe(false);
        });
    });
});
