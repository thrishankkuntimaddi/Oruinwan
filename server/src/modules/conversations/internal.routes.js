const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const repairController = require('./conversationKeys.repair.controller');

function requirePlatformAdmin(req, res, next) {
    const { users } = require('../../identity');

    
    if (!req.user || !req.user.sub) {
        logger.error(`🚫 [AUDIT][PHASE2][AUTH] Unauthorized access attempt`);
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    
    users.findById(req.user.sub).then(user => {
        if (!user || !user.roles || !user.roles.includes('chttrix_admin')) {
            logger.error(`🚫 [AUDIT][PHASE2][AUTH] Non-admin access attempt`);
            logger.error(`   ├─ User: ${req.user.sub}`);
            logger.error(`   ├─ Roles: ${user?.roles || 'unknown'}`);
            logger.error(`   └─ Required: chttrix_admin`);
            return res.status(403).json({
                success: false,
                error: 'Platform admin authorization required'
            });
        }

        logger.info(`✅ [AUDIT][PHASE2][AUTH] Admin authorized`);
        logger.info(`   ├─ User: ${user.email}`);
        logger.info(`   └─ Roles: ${user.roles.join(', ')}`);

        next();
    }).catch(err => {
        logger.error(`❌ [AUDIT][PHASE2][AUTH] Authorization check failed:`, err);
        return res.status(500).json({
            success: false,
            error: 'Authorization check failed'
        });
    });
}

router.post(
    '/repair-conversation-key',
    requireAuth,
    requirePlatformAdmin,
    repairController.repairConversationKey
);

module.exports = router;
