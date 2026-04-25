const crypto = require('crypto');
const { UserWorkspaceKey, WorkspaceKey } = require('../../../models/encryption');

function generateWorkspaceKey() {
    return crypto.randomBytes(32);
}

function generateIV() {
    return crypto.randomBytes(12);
}

function generateSalt() {
    return crypto.randomBytes(16);
}

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

async function enrollUserInWorkspace(userId, workspaceId, workspaceKey, userKEK, userSalt) {
    try {
        
        const { encryptedKey, iv } = encryptWorkspaceKeyServer(workspaceKey, userKEK);

        
        const userKey = await UserWorkspaceKey.create({
            userId,
            workspaceId,
            encryptedKey,
            keyIv: iv,
            pbkdf2Salt: userSalt.toString('base64'),
            pbkdf2Iterations: 100000
        });

        console.log(`🔐 Enrolled user ${userId} in workspace ${workspaceId}`);
        return userKey;
    } catch (err) {
        console.error('User enrollment failed:', err);
        throw err;
    }
}

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
        console.log(`🔐 Bulk enrolled ${result.length} users in workspace ${workspaceId}`);
        return result.length;
    } catch (err) {
        console.error('Bulk enrollment failed:', err);
        throw err;
    }
}

async function revokeUserAccess(userId, workspaceId) {
    try {
        const result = await UserWorkspaceKey.deleteOne({ userId, workspaceId });
        console.log(`🔐 Revoked access for user ${userId} in workspace ${workspaceId}`);
        return result.deletedCount > 0;
    } catch (err) {
        console.error('Access revocation failed:', err);
        throw err;
    }
}

async function bulkRevokeAccess(userIds, workspaceId) {
    try {
        const result = await UserWorkspaceKey.deleteMany({
            userId: { $in: userIds },
            workspaceId
        });
        return result.deletedCount;
    } catch (err) {
        console.error('Bulk revocation failed:', err);
        throw err;
    }
}

async function getUserWorkspaceKeys(userId) {
    try {
        const keys = await UserWorkspaceKey.find({ userId })
            .populate('workspaceId', 'name icon')
            .lean();
        return keys;
    } catch (err) {
        console.error('Failed to fetch user keys:', err);
        throw err;
    }
}

async function getWorkspaceMasterKey(workspaceId) {
    try {
        const key = await WorkspaceKey.findOne({ workspaceId, isActive: true }).lean();
        return key;
    } catch (err) {
        console.error('Failed to fetch workspace master key:', err);
        throw err;
    }
}

async function createWorkspaceKey(workspaceId, creatorId, creatorKEK) {
    try {
        
        const workspaceKey = generateWorkspaceKey();

        
        const { encryptedKey, iv } = encryptWorkspaceKeyServer(workspaceKey, creatorKEK);

        
        const workspaceKeyDoc = await WorkspaceKey.create({
            workspaceId,
            encryptedMasterKey: encryptedKey,
            masterKeyIv: iv,
            createdBy: creatorId,
            isActive: true
        });

        console.log(`🔐 Created workspace key for ${workspaceId}`);
        return { workspaceKey, workspaceKeyDoc };
    } catch (err) {
        console.error('Workspace key creation failed:', err);
        throw err;
    }
}

async function userHasWorkspaceAccess(userId, workspaceId) {
    try {
        const key = await UserWorkspaceKey.findOne({ userId, workspaceId });
        return key !== null;
    } catch (err) {
        console.error('Access check failed:', err);
        return false;
    }
}

module.exports = {
    
    generateWorkspaceKey,
    generateIV,
    generateSalt,

    
    enrollUserInWorkspace,
    bulkEnrollUsers,

    
    revokeUserAccess,
    bulkRevokeAccess,

    
    getUserWorkspaceKeys,
    getWorkspaceMasterKey,

    
    createWorkspaceKey,

    
    userHasWorkspaceAccess
};
