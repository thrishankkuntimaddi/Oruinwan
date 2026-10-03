const logger = require('../../../utils/logger');
const { identityKeys } = require('../../identity');

async function storePublicKey(userId, publicKey, algorithm, version = 1) {
    try {
        
        const keyDoc = await identityKeys.upsert(userId, { publicKey, algorithm, version });

        logger.info(`✅ Stored public ${algorithm} key for user ${userId}`);
        return keyDoc;
    } catch (error) {
        logger.error('Failed to store public key:', error);
        throw error;
    }
}

async function getPublicKey(userId) {
    try {
        const keyDoc = await identityKeys.findByUserId(userId);
        return keyDoc;
    } catch (error) {
        logger.error('Failed to fetch public key:', error);
        throw error;
    }
}

async function batchGetPublicKeys(userIds) {
    try {
        const keyDocs = await identityKeys.batchFindByUserIds(userIds);
        return keyDocs;
    } catch (error) {
        logger.error('Failed to batch fetch public keys:', error);
        throw error;
    }
}

async function hasPublicKey(userId) {
    try {
        const keyDoc = await identityKeys.findByUserId(userId);
        return keyDoc !== null;
    } catch (error) {
        logger.error('Failed to check public key:', error);
        return false;
    }
}

async function deletePublicKey(userId) {
    try {
        const existed = !!(await identityKeys.findByUserId(userId));
        await identityKeys.remove(userId);
        logger.info(`🗑️ Deleted public key for user ${userId}`);
        return existed;
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
