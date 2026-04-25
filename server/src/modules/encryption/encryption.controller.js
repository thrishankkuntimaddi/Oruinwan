'use strict';

const encryptionService = require('./encryption.service');
const { handleError } = require('../../../utils/responseHelpers');
const Workspace = require('../../../models/Workspace');
const logger = require('../../shared/utils/logger');

exports.getUserKeys = async (req, res) => {
    try {
        const userId = req.user.sub;
        const keys = await encryptionService.getUserWorkspaceKeys(userId);

        return res.json({ keys });
    } catch (err) {
        return handleError(res, err, 'GET USER KEYS ERROR');
    }
};

exports.enrollUser = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, encryptedWorkspaceKey, keyIv, pbkdf2Salt } = req.body;

        if (!workspaceId || !encryptedWorkspaceKey || !keyIv || !pbkdf2Salt) {
            return res.status(400).json({
                message: 'Missing required fields: workspaceId, encryptedWorkspaceKey, keyIv, pbkdf2Salt'
            });
        }

        
        
        const { UserWorkspaceKey } = require('../../../models/encryption');

        const userKey = await UserWorkspaceKey.create({
            userId,
            workspaceId,
            encryptedKey: encryptedWorkspaceKey,
            keyIv,
            pbkdf2Salt,
            pbkdf2Iterations: 100000
        });

        return res.status(201).json({
            message: 'User enrolled successfully',
            keyId: userKey._id
        });
    } catch (err) {
        return handleError(res, err, 'ENROLL USER ERROR');
    }
};

exports.revokeAccess = async (req, res) => {
    try {
        const { userId, workspaceId } = req.body;
        const requesterId = req.user.sub;

        if (!userId || !workspaceId) {
            return res.status(400).json({
                message: 'Missing required fields: userId, workspaceId',
            });
        }

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }
        if (!workspace.isAdminOrOwner(requesterId)) {
            logger.warn({ requesterId, workspaceId, targetUserId: userId }, 'Unauthorized revoke attempt blocked');
            return res.status(403).json({
                message: 'Only workspace administrators can revoke encryption access',
            });
        }

        const revoked = await encryptionService.revokeUserAccess(userId, workspaceId);

        if (!revoked) {
            return res.status(404).json({ message: 'User access not found' });
        }

        logger.info({ requesterId, workspaceId, targetUserId: userId }, 'Encryption access revoked');

        return res.json({
            message: 'Access revoked successfully',
            userId,
            workspaceId,
        });
    } catch (err) {
        return handleError(res, err, 'REVOKE ACCESS ERROR');
    }
};

exports.checkAccess = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const hasAccess = await encryptionService.userHasWorkspaceAccess(userId, workspaceId);

        return res.json({ hasAccess });
    } catch (err) {
        return handleError(res, err, 'CHECK ACCESS ERROR');
    }
};

exports.storePersonalKeys = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { publicKey, encryptedPrivateKey } = req.body;

        if (!publicKey || !encryptedPrivateKey) {
            return res.status(400).json({
                message: 'Missing required fields: publicKey, encryptedPrivateKey'
            });
        }

        const User = require('../../../models/User');
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        
        user.encryption = {
            publicKey,
            encryptedPrivateKey,
            keyVersion: 1,
            createdAt: new Date()
        };

        await user.save();

        return res.status(201).json({
            message: 'Personal encryption keys stored successfully',
            keyVersion: 1
        });
    } catch (err) {
        return handleError(res, err, 'STORE PERSONAL KEYS ERROR');
    }
};

exports.getMyPersonalKeys = async (req, res) => {
    try {
        const userId = req.user.sub;
        const User = require('../../../models/User');

        const user = await User.findById(userId).select('encryption');

        if (!user || !user.encryption) {
            return res.status(404).json({
                message: 'Personal encryption keys not found',
                hasKeys: false
            });
        }

        return res.json({
            hasKeys: true,
            publicKey: user.encryption.publicKey,
            encryptedPrivateKey: user.encryption.encryptedPrivateKey,
            keyVersion: user.encryption.keyVersion
        });
    } catch (err) {
        return handleError(res, err, 'GET PERSONAL KEYS ERROR');
    }
};

exports.getUserPublicKey = async (req, res) => {
    try {
        const { userId } = req.params;
        const User = require('../../../models/User');

        const user = await User.findById(userId).select('encryption.publicKey username');

        if (!user || !user.encryption?.publicKey) {
            return res.status(404).json({
                message: 'User has not enabled E2EE',
                hasPublicKey: false
            });
        }

        return res.json({
            hasPublicKey: true,
            publicKey: user.encryption.publicKey,
            username: user.username
        });
    } catch (err) {
        return handleError(res, err, 'GET USER PUBLIC KEY ERROR');
    }
};
