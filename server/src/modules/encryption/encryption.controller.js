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
    } catch (err) {
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
    } catch (err) {
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
        const requesterId = req.user.sub;

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
    } catch (err) {
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
    } catch (err) {
        return handleError(res, err, 'CHECK ACCESS ERROR');
    }
};
