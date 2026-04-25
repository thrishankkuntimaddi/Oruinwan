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

        console.log(`✅ Stored public ${algorithm} key for user ${userId}`);
        return keyDoc;
    } catch (error) {
        console.error('Failed to store public key:', error);
        throw error;
    }
}

async function getPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc;
    } catch (error) {
        console.error('Failed to fetch public key:', error);
        throw error;
    }
}

async function batchGetPublicKeys(userIds) {
    try {
        const keyDocs = await UserIdentityKey.batchFindByUserIds(userIds);
        return keyDocs;
    } catch (error) {
        console.error('Failed to batch fetch public keys:', error);
        throw error;
    }
}

async function hasPublicKey(userId) {
    try {
        const keyDoc = await UserIdentityKey.findByUserId(userId);
        return keyDoc !== null;
    } catch (error) {
        console.error('Failed to check public key:', error);
        return false;
    }
}

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

module.exports = {
    storePublicKey,
    getPublicKey,
    batchGetPublicKeys,
    hasPublicKey,
    deletePublicKey
};
