/**
 * @owner encryption-module
 * @status legacy
 * @remove-after 2026-03
 * @deprecated Use src/modules/encryption/ instead
 * 
 * FROZEN: This file is in legacy mode. Do NOT add new features here.
 * All new encryption functionality should go to src/modules/encryption/
 * 
 * Key Management Controller
 * 
 * Business logic for E2EE key operations:
 * - Key enrollment when user joins workspace
 * - Key distribution
 * - Access revocation
 */

const crypto = require('crypto');
const { UserWorkspaceKey, WorkspaceKey } = require('../models/encryption');

// ==================== KEY GENERATION ====================

/**
 * Generate a random 256-bit workspace key
 * Used when creating new workspaces
 * 
 * @returns {Buffer} 32-byte random key
 */
function generateWorkspaceKey() {
    return crypto.randomBytes(32); // 256 bits
}

/**
 * Generate random IV (12 bytes for AES-GCM)
 * 
 * @returns {Buffer} 12-byte random IV
 */
function generateIV() {
    return crypto.randomBytes(12);
}

/**
 * Generate random salt for PBKDF2
 * 
 * @returns {Buffer} 16-byte random salt
 */
function generateSalt() {
    return crypto.randomBytes(16);
}

// ==================== KEY ENCRYPTION (SERVER-SIDE) ====================

/**
 * Encrypt workspace key with user's KEK
 * This is done server-side when enrolling a new user
 * 
 * @param {Buffer} workspaceKey - Raw workspace key bytes
 * @param {Buffer} kek - Key Encryption Key (derived from user password)
 * @returns {{encryptedKey: string, iv: string}} Base64-encoded
 */
function encryptWorkspaceKeyServer(workspaceKey, kek) {
    const iv = generateIV();

    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);

    let encrypted = cipher.update(workspaceKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, authTag]);

    return {
        encryptedKey: ciphertext.toString('base64'),
        iv: iv.toString('base64')
    };
}

// ==================== USER ENROLLMENT ====================

/**
 * Enroll user in workspace with encrypted key
 * Called when user joins a workspace
 * 
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @param {Buffer} workspaceKey - Raw workspace key
 * @param {Buffer} userKEK - User's Key Encryption Key
 * @param {Buffer} userSalt - User's PBKDF2 salt
 * @returns {Promise<object>} Created UserWorkspaceKey document
 */
async function enrollUserInWorkspace(userId, workspaceId, workspaceKey, userKEK, userSalt) {
    try {
        // Encrypt workspace key with user's KEK
        const { encryptedKey, iv } = encryptWorkspaceKeyServer(workspaceKey, userKEK);

        // Store encrypted key in database
        const userKey = await UserWorkspaceKey.create({
            userId,
            workspaceId,
            encryptedKey,
            keyIv: iv,
            pbkdf2Salt: userSalt.toString('base64'),
            pbkdf2Iterations: 100000
        });

        return userKey;
    } catch (error) {
        console.error('User enrollment failed:', error);
        throw error;
    }
}

/**
 * Bulk enroll multiple users in workspace
 * Used when workspace is created with initial members
 * 
 * @param {string} workspaceId - Workspace ID
 * @param {Array} userEnrollments - Array of {userId, kek, salt}
 * @param {Buffer} workspaceKey - Raw workspace key
 * @returns {Promise<number>} Number of users enrolled
 */
async function bulkEnrollUsers(workspaceId, userEnrollments, workspaceKey) {
    try {
        const enrollments = userEnrollments.map(({ userId, kek, salt }) => {
            const { encryptedKey, iv } = encryptWorkspaceKeyServer(workspaceKey, kek);

            return {
                userId,
                workspaceId,
                encryptedKey,
                keyIv: iv,
                pbkdf2Salt: salt.toString('base64'),
                pbkdf2Iterations: 100000
            };
        });

        const result = await UserWorkspaceKey.insertMany(enrollments);

        return result.length;
    } catch (error) {
        console.error('Bulk enrollment failed:', error);
        throw error;
    }
}

// ==================== ACCESS REVOCATION ====================

/**
 * Revoke user's access to workspace
 * Deletes their encrypted workspace key
 * 
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>} True if revoked
 */
async function revokeUserAccess(userId, workspaceId) {
    try {
        const result = await UserWorkspaceKey.deleteOne({
            userId,
            workspaceId
        });

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Access revocation failed:', error);
        throw error;
    }
}

/**
 * Revoke access for multiple users
 * Used when removing multiple members from workspace
 * 
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<number>} Number of users revoked
 */
async function bulkRevokeAccess(userIds, workspaceId) {
    try {
        const result = await UserWorkspaceKey.deleteMany({
            userId: { $in: userIds },
            workspaceId
        });

        return result.deletedCount;
    } catch (error) {
        console.error('Bulk revocation failed:', error);
        throw error;
    }
}

// ==================== KEY RETRIEVAL ====================

/**
 * Get all workspace keys for user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of encrypted workspace keys
 */
async function getUserWorkspaceKeys(userId) {
    try {
        const keys = await UserWorkspaceKey.find({ userId })
            .populate('workspaceId', 'name icon')
            .lean();

        return keys;
    } catch (error) {
        console.error('Failed to fetch user keys:', error);
        throw error;
    }
}

/**
 * Get workspace master key
 * Used by admins to distribute to new members
 * 
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<object|null>} Workspace key or null
 */
async function getWorkspaceMasterKey(workspaceId) {
    try {
        const key = await WorkspaceKey.findOne({ workspaceId, isActive: true }).lean();
        return key;
    } catch (error) {
        console.error('Failed to fetch workspace master key:', error);
        throw error;
    }
}

// ==================== WORKSPACE KEY CREATION ====================

/**
 * Create workspace encryption key
 * Called when workspace is created
 * 
 * @param {string} workspaceId - Workspace ID
 * @param {string} creatorId - User ID of workspace creator
 * @param {Buffer} creatorKEK - Creator's KEK
 * @returns {Promise<{workspaceKey: Buffer, workspaceKeyDoc: object}>}
 */
async function createWorkspaceKey(workspaceId, creatorId, creatorKEK) {
    try {
        // Generate random workspace key
        const workspaceKey = generateWorkspaceKey();

        // Encrypt with creator's KEK for storage
        const { encryptedKey, iv } = encryptWorkspaceKeyServer(workspaceKey, creatorKEK);

        // Store encrypted workspace key
        const workspaceKeyDoc = await WorkspaceKey.create({
            workspaceId,
            encryptedMasterKey: encryptedKey,
            masterKeyIv: iv,
            createdBy: creatorId,
            isActive: true
        });

        return {
            workspaceKey, // Raw key (to distribute to initial members)
            workspaceKeyDoc
        };
    } catch (error) {
        console.error('Workspace key creation failed:', error);
        throw error;
    }
}

// ==================== KEY VERIFICATION ====================

/**
 * Check if user has access to workspace
 * 
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>} True if user has key
 */
async function userHasWorkspaceAccess(userId, workspaceId) {
    try {
        const key = await UserWorkspaceKey.findOne({ userId, workspaceId });
        return key !== null;
    } catch (error) {
        console.error('Access check failed:', error);
        return false;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    // Key generation
    generateWorkspaceKey,
    generateIV,
    generateSalt,

    // Enrollment
    enrollUserInWorkspace,
    bulkEnrollUsers,

    // Revocation
    revokeUserAccess,
    bulkRevokeAccess,

    // Retrieval
    getUserWorkspaceKeys,
    getWorkspaceMasterKey,

    // Creation
    createWorkspaceKey,

    // Verification
    userHasWorkspaceAccess
};
