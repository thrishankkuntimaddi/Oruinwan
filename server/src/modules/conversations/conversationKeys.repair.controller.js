const logger = require('../../../utils/logger');
const conversationKeysService = require('./conversationKeys.service');

async function repairConversationKey(req, res) {
    const { channelId, userId } = req.body;
    const callerId = req.user?.sub; 

    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`🔧 [AUDIT][PHASE2][TRIGGER] Repair endpoint called`);
    logger.info(`   ├─ Caller: ${callerId}`);
    logger.info(`   ├─ Channel: ${channelId}`);
    logger.info(`   ├─ User: ${userId}`);
    logger.info(`   └─ Timestamp: ${new Date().toISOString()}`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        
        if (!channelId || !userId) {
            logger.error(`❌ [AUDIT][PHASE2][TRIGGER] Missing required fields`);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: channelId and userId'
            });
        }

        
        const result = await conversationKeysService.repairConversationKeyForUser(
            channelId,
            userId
        );

        
        logger.info(`📊 [AUDIT][PHASE2][TRIGGER] Repair completed`);
        logger.info(`   ├─ Result: ${result.result}`);
        logger.info(`   └─ Reason: ${result.reason || 'N/A'}`);

        
        if (result.result === 'REPAIR_SUCCESS') {
            return res.status(200).json({
                success: true,
                result: result.result,
                userId: result.userId,
                channelId: result.channelId,
                algorithm: result.algorithm,
                message: 'INV-001 violation repaired successfully'
            });
        } else if (result.result === 'NO_REPAIR_NEEDED') {
            return res.status(200).json({
                success: true,
                result: result.result,
                reason: result.reason,
                message: 'User already has encryption key (idempotent)'
            });
        } else {
            
            return res.status(400).json({
                success: false,
                result: result.result,
                reason: result.reason,
                message: 'Cannot repair - safety gate failed'
            });
        }

    } catch (error) {
        logger.error(`❌ [AUDIT][PHASE2][TRIGGER] Endpoint exception:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

module.exports = {
    repairConversationKey
};
