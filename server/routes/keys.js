/**
 * Encryption Keys API Routes
 * 
 * Endpoints for E2EE key management:
 * - Fetch encrypted workspace keys
 * - Enroll new users in workspaces
 * - Revoke user access
 */

const express = require('express');
const router = express.Router();
const { UserWorkspaceKey, WorkspaceKey } = require('../models/encryption');
const requireAuth = require('../middleware/auth');

// ==================== GET USER'S ENCRYPTED KEYS ====================

/**
 * GET /api/keys/all
 * Fetch all encrypted workspace keys for authenticated user
 */
router.get('/all', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        // Fetch all workspace keys for this user
        const userKeys = await UserWorkspaceKey.find({ userId })
            .populate('workspaceId', 'name')
            .lean();

        if (!userKeys || userKeys.length === 0) {
            return res.json({ encryptedKeys: [] });
        }

        // Format response
        const encryptedKeys = userKeys.map(key => ({
            workspaceId: key.workspaceId._id || key.workspaceId,
            workspaceName: key.workspaceId.name,
            encryptedKey: key.encryptedKey,
            iv: key.keyIv,
            salt: key.pbkdf2Salt,
            iterations: key.pbkdf2Iterations,
            keyVersion: key.keyVersion
        }));

        res.json({ encryptedKeys });

    } catch (error) {
        console.error('Failed to fetch user keys:', error);
        res.status(500).json({
            message: 'Failed to fetch encryption keys',
            error: error.message
        });
    }
});

/**
 * GET /api/keys/workspace/:workspaceId
 * Fetch encrypted key for specific workspace
 */
router.get('/workspace/:workspaceId', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { workspaceId } = req.params;

        // Fetch workspace key for this user
        const userKey = await UserWorkspaceKey.findOne({
            userId,
            workspaceId
        }).lean();

        if (!userKey) {
            return res.status(404).json({
                message: 'No encryption key found for this workspace'
            });
        }

        // Format response
        const encryptedKey = {
            workspaceId: userKey.workspaceId,
            encryptedKey: userKey.encryptedKey,
            iv: userKey.keyIv,
            salt: userKey.pbkdf2Salt,
            iterations: userKey.pbkdf2Iterations,
            keyVersion: userKey.keyVersion
        };

        res.json({ encryptedKey });

    } catch (error) {
        console.error('Failed to fetch workspace key:', error);
        res.status(500).json({
            message: 'Failed to fetch encryption key',
            error: error.message
        });
    }
});

// ==================== ENROLL NEW USER ====================

/**
 * POST /api/keys/enroll
 * Enroll user in workspace (distribute encrypted workspace key)
 * 
 * Body: {
 *   workspaceId: string,
 *   encryptedKey: string (Base64),
 *   keyIv: string (Base64),
 *   pbkdf2Salt: string (Base64)
 * }
 */
router.post('/enroll', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            workspaceId,
            encryptedKey,
            keyIv,
            pbkdf2Salt,
            pbkdf2Iterations = 100000
        } = req.body;

        // Validate input
        if (!workspaceId || !encryptedKey || !keyIv || !pbkdf2Salt) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Check if user already enrolled
        const existing = await UserWorkspaceKey.findOne({ userId, workspaceId });

        if (existing) {
            return res.status(409).json({
                message: 'User already enrolled in this workspace'
            });
        }

        // Create user workspace key
        const userKey = await UserWorkspaceKey.create({
            userId,
            workspaceId,
            encryptedKey,
            keyIv,
            pbkdf2Salt,
            pbkdf2Iterations
        });

        res.status(201).json({
            message: 'User enrolled successfully',
            keyId: userKey._id
        });

    } catch (error) {
        console.error('User enrollment failed:', error);
        res.status(500).json({
            message: 'Enrollment failed',
            error: error.message
        });
    }
});

// ==================== REVOKE ACCESS ====================

/**
 * DELETE /api/keys/revoke/:workspaceId
 * Revoke user's access to workspace (delete their encrypted key)
 */
router.delete('/revoke/:workspaceId', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { workspaceId } = req.params;

        // Delete user's workspace key
        const result = await UserWorkspaceKey.deleteOne({
            userId,
            workspaceId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: 'No key found to revoke'
            });
        }

        res.json({
            message: 'Access revoked successfully'
        });

    } catch (error) {
        console.error('Key revocation failed:', error);
        res.status(500).json({
            message: 'Revocation failed',
            error: error.message
        });
    }
});

// ==================== ADMIN: CREATE WORKSPACE KEY ====================

/**
 * POST /api/keys/workspace/create
 * Create workspace master key (called when workspace is created)
 * 
 * Body: {
 *   workspaceId: string,
 *   encryptedMasterKey: string (Base64),
 *   masterKeyIv: string (Base64)
 * }
 */
router.post('/workspace/create', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { workspaceId, encryptedMasterKey, masterKeyIv } = req.body;

        // Validate input
        if (!workspaceId || !encryptedMasterKey || !masterKeyIv) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Check if workspace key already exists
        const existing = await WorkspaceKey.findOne({ workspaceId });

        if (existing) {
            return res.status(409).json({
                message: 'Workspace key already exists'
            });
        }

        // Create workspace key
        const workspaceKey = await WorkspaceKey.create({
            workspaceId,
            encryptedMasterKey,
            masterKeyIv,
            createdBy: userId
        });

        res.status(201).json({
            message: 'Workspace key created',
            keyId: workspaceKey._id
        });

    } catch (error) {
        console.error('Workspace key creation failed:', error);
        res.status(500).json({
            message: 'Key creation failed',
            error: error.message
        });
    }
});

// ==================== ADMIN: GET WORKSPACE MASTER KEY ====================

/**
 * GET /api/keys/workspace/:workspaceId/master
 * Get workspace master key (for distributing to new users)
 * Only workspace admins can access this
 */
router.get('/workspace/:workspaceId/master', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { workspaceId } = req.params;

        // TODO: Add admin permission check
        // const isAdmin = await checkWorkspaceAdmin(userId, workspaceId);
        // if (!isAdmin) {
        //   return res.status(403).json({ message: 'Admin access required' });
        // }

        // Fetch workspace master key
        const workspaceKey = await WorkspaceKey.findOne({ workspaceId }).lean();

        if (!workspaceKey) {
            return res.status(404).json({
                message: 'Workspace key not found'
            });
        }

        res.json({
            encryptedMasterKey: workspaceKey.encryptedMasterKey,
            masterKeyIv: workspaceKey.masterKeyIv,
            keyVersion: workspaceKey.keyVersion
        });

    } catch (error) {
        console.error('Failed to fetch workspace master key:', error);
        res.status(500).json({
            message: 'Failed to fetch workspace key',
            error: error.message
        });
    }
});

// ==================== KEY ROTATION (FUTURE) ====================

/**
 * POST /api/keys/workspace/:workspaceId/rotate
 * Rotate workspace key (Phase 2 feature)
 * 
 * When implemented, this will:
 * 1. Generate new workspace key
 * 2. Re-encrypt for all members
 * 3. Mark old key as inactive
 */
router.post('/workspace/:workspaceId/rotate', requireAuth, async (req, res) => {
    res.status(501).json({
        message: 'Key rotation not yet implemented (Phase 2 feature)'
    });
});

module.exports = router;
