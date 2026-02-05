// server/src/modules/encryption/encryption.controller.js
/**
 * Encryption Controller - E2EE HTTP Endpoints
 * Handles encryption key management API requests
 * 
 * @module encryption/controller
 */

const encryptionService = require('./encryption.service');
const { handleError } = require('../../../utils/responseHelpers');

/**
 * Get all workspace keys for authenticated user
 * GET /api/encryption/keys
 */
exports.getUserKeys = async (req, res) => {
    try {
        const userId = req.user.sub;
        const keys = await encryptionService.getUserWorkspaceKeys(userId);

        return res.json({ keys });
    } catch (_err) {
        return handleError(res, err, 'GET USER KEYS ERROR');
    }
};

/**
 * Enroll user in workspace encryption
 * POST /api/encryption/enroll
 * 
 * Body: {
 *   workspaceId: string,
 *   encryptedWorkspaceKey: string (base64),
 *   keyIv: string (base64),
 *   pbkdf2Salt: string (base64)
 * }
 */
exports.enrollUser = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, encryptedWorkspaceKey, keyIv, pbkdf2Salt } = req.body;

        if (!workspaceId || !encryptedWorkspaceKey || !keyIv || !pbkdf2Salt) {
            return res.status(400).json({
                message: 'Missing required fields: workspaceId, encryptedWorkspaceKey, keyIv, pbkdf2Salt'
            });
        }

        // Note: In this flow, client sends already-encrypted key
        // Server doesn't need the raw KEK, just stores the encrypted data
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
    } catch (_err) {
        return handleError(res, err, 'ENROLL USER ERROR');
    }
};

/**
 * Revoke user's access to workspace
 * DELETE /api/encryption/revoke
 * 
 * Body: {
 *   userId: string,
 *   workspaceId: string
 * }
 */
exports.revokeAccess = async (req, res) => {
    try {
        const { userId, workspaceId } = req.body;
        const _requesterId = req.user.sub;

        // TODO: Add authorization check (only workspace admins can revoke)

        if (!userId || !workspaceId) {
            return res.status(400).json({
                message: 'Missing required fields: userId, workspaceId'
            });
        }

        const revoked = await encryptionService.revokeUserAccess(userId, workspaceId);

        if (!revoked) {
            return res.status(404).json({
                message: 'User access not found'
            });
        }

        return res.json({
            message: 'Access revoked successfully',
            userId,
            workspaceId
        });
    } catch (_err) {
        return handleError(res, err, 'REVOKE ACCESS ERROR');
    }
};

/**
 * Check if user has workspace access
 * GET /api/encryption/access/:workspaceId
 */
exports.checkAccess = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const hasAccess = await encryptionService.userHasWorkspaceAccess(userId, workspaceId);

        return res.json({ hasAccess });
    } catch (_err) {
        return handleError(res, err, 'CHECK ACCESS ERROR');
    }
};

// ==================== PERSONAL E2EE CONTROLLERS ====================

/**
 * Store user's personal encryption keys (for DM E2EE)
 * POST /api/encryption/personal/keys
 * 
 * Body: {
 *   publicKey: string (base64),
 *   encryptedPrivateKey: string (JSON string of encrypted data)
 * }
 */
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

        // Store encryption keys
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
    } catch (_err) {
        return handleError(res, err, 'STORE PERSONAL KEYS ERROR');
    }
};

/**
 * Get user's own personal encryption keys
 * GET /api/encryption/personal/keys
 */
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
    } catch (_err) {
        return handleError(res, err, 'GET PERSONAL KEYS ERROR');
    }
};

/**
 * Get another user's public key (for DM encryption)
 * GET /api/encryption/personal/users/:userId/public-key
 */
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
    } catch (_err) {
        return handleError(res, err, 'GET USER PUBLIC KEY ERROR');
    }
};
