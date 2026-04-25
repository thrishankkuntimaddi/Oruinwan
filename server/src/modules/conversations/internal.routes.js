const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const repairController = require('./conversationKeys.repair.controller');

function requirePlatformAdmin(req, res, next) {
    const User = require('../../../models/User');

    
    if (!req.user || !req.user.sub) {
        console.error(`🚫 [AUDIT][PHASE2][AUTH] Unauthorized access attempt`);
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    
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

router.post(
    '/repair-conversation-key',
    requireAuth,
    requirePlatformAdmin,
    repairController.repairConversationKey
);

module.exports = router;
