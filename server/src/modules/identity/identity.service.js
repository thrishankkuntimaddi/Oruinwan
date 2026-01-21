/**
 * Identity Service - Server-side
 * 
 * Handles storage and retrieval of user public identity keys
 * NEVER generates keys (client-only operation)
 */

const UserIdentityKey = require('../../../models/UserIdentityKey');

// ==================== PUBLIC KEY STORAGE ====================

/**
 * Store or update user's public identity key
 * Called when user registers or generates new key
 * 
 * @param {String} userId - User ID
 * @param {String} publicKey - PEM-encoded public key
 * @param {String} algorithm - 'X25519' or 'RSA-2048'
 * @param {Number} version - Key version
 * @returns {Promise<Object>} Stored key document
 */
async function storePublicKey(userId, publicKey, algorithm, version = 1) {
    try {
        // Upsert: update if exists, create if not
        const keyDoc = await UserIdentityKey.findOneAndUpdate(
            { userId },
            {
                publicKey,
                algorithm,
                version,
                updatedAt: new Date()
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`✅ Stored public ${algorithm} key for user ${userId}`);
        return keyDoc;
    } catch (error) {
        console.error('Failed to store public key:', error);
        throw error;
    }
}

// ==================== PUBLIC KEY RETRIEVAL ====================

/**
 * Get user's public identity key
 * 
 * @param {String} userId - User ID
 * @returns {Promise<Object|null>} Key document or null
 */
async function getPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc;
    } catch (error) {
        console.error('Failed to fetch public key:', error);
        throw error;
    }
}

/**
 * Batch fetch multiple users' public keys
 * For efficient key distribution
 * 
 * @param {String[]} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of key documents
 */
async function batchGetPublicKeys(userIds) {
    try {
        const keyDocs = await UserIdentityKey.batchFindByUserIds(userIds);
        return keyDocs;
    } catch (error) {
        console.error('Failed to batch fetch public keys:', error);
        throw error;
    }
}

// ==================== KEY VERIFICATION ====================

/**
 * Check if user has uploaded public key
 * 
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} True if key exists
 */
async function hasPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc !== null;
    } catch (error) {
        console.error('Failed to check public key:', error);
        return false;
    }
}

// ==================== KEY ROTATION ====================

/**
 * Delete user's public key
 * Used when user rotates keys or deletes account
 * 
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} True if deleted
 */
async function deletePublicKey(userId) {
    try {
        const result = await UserIdentityKey.deleteOne({ userId });
        console.log(`🗑️ Deleted public key for user ${userId}`);
        return result.deletedCount > 0;
    } catch (error) {
        console.error('Failed to delete public key:', error);
        throw error;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    storePublicKey,
    getPublicKey,
    batchGetPublicKeys,
    hasPublicKey,
    deletePublicKey
};
