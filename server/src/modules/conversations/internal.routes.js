/**
 * PHASE 2: Internal Admin Routes for E2EE Repair
 * 
 * Admin-only endpoints for explicitly repairing INV-001 violations
 * DO NOT expose to public API
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const repairController = require('./conversationKeys.repair.controller');

/**
 * Middleware: Platform Admin Only
 * 
 * Restricts access to Chttrix platform admin
 */
function requirePlatformAdmin(req, res, next) {
    const User = require('../../../models/User');

    // Check if user is authenticated
    if (!req.user || !req.user.sub) {
        console.error(`🚫 [AUDIT][PHASE2][AUTH] Unauthorized access attempt`);
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    // Check if user is platform admin (chttrix_admin role)
    User.findById(req.user.sub).then(user => {
        if (!user || !user.roles || !user.roles.includes('chttrix_admin')) {
            console.error(`🚫 [AUDIT][PHASE2][AUTH] Non-admin access attempt`);
            console.error(`   ├─ User: ${req.user.sub}`);
            console.error(`   ├─ Roles: ${user?.roles || 'unknown'}`);
            console.error(`   └─ Required: chttrix_admin`);
            return res.status(403).json({
                success: false,
                error: 'Platform admin authorization required'
            });
        }

        console.log(`✅ [AUDIT][PHASE2][AUTH] Admin authorized`);
        console.log(`   ├─ User: ${user.email}`);
        console.log(`   └─ Roles: ${user.roles.join(', ')}`);

        next();
    }).catch(err => {
        console.error(`❌ [AUDIT][PHASE2][AUTH] Authorization check failed:`, err);
        return res.status(500).json({
            success: false,
            error: 'Authorization check failed'
        });
    });
}

/**
 * POST /internal/e2ee/repair-conversation-key
 * 
 * Explicitly repair INV-001 violation for a single user
 * 
 * Authorization: Platform admin only
 * 
 * Body:
 * {
 *   "channelId": "<string>",
 *   "userId": "<string>"
 * }
 * 
 * Response:
 * {
 *   "success": true/false,
 *   "result": "REPAIR_SUCCESS" | "NO_REPAIR_NEEDED" | "CANNOT_REPAIR_*",
 *   "reason": "<string>"
 * }
 */
router.post(
    '/repair-conversation-key',
    requireAuth,
    requirePlatformAdmin,
    repairController.repairConversationKey
);

module.exports = router;
