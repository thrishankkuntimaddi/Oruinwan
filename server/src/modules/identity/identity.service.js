const logger = require('../../../utils/logger');
const UserIdentityKey = require('../../../models/UserIdentityKey');

async function storePublicKey(userId, publicKey, algorithm, version = 1) {
    try {
        
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

        logger.info(`✅ Stored public ${algorithm} key for user ${userId}`);
        return keyDoc;
    } catch (error) {
        logger.error('Failed to store public key:', error);
        throw error;
    }
}

async function getPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc;
    } catch (error) {
        logger.error('Failed to fetch public key:', error);
        throw error;
    }
}

async function batchGetPublicKeys(userIds) {
    try {
        const keyDocs = await UserIdentityKey.batchFindByUserIds(userIds);
        return keyDocs;
    } catch (error) {
        logger.error('Failed to batch fetch public keys:', error);
        throw error;
    }
}

async function hasPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc !== null;
    } catch (error) {
        logger.error('Failed to check public key:', error);
        return false;
    }
}

async function deletePublicKey(userId) {
    try {
        const result = await UserIdentityKey.deleteOne({ userId });
        logger.info(`🗑️ Deleted public key for user ${userId}`);
        return result.deletedCount > 0;
    } catch (error) {
        logger.error('Failed to delete public key:', error);
        throw error;
    }
}

module.exports = {
    storePublicKey,
    getPublicKey,
    batchGetPublicKeys,
    hasPublicKey,
    deletePublicKey
};
