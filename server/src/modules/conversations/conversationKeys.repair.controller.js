/**
 * PHASE 2: Admin-Only Repair Endpoint Controller
 * 
 * Provides explicit trigger for repairing INV-001 violations
 * ADMIN-ONLY: Requires platform admin authorization
 */

const conversationKeysService = require('./conversationKeys.service');

/**
 * POST /internal/e2ee/repair-conversation-key
 * 
 * Explicitly repair a single user's conversation key access
 * 
 * Request Body:
 * {
 *   "channelId": "<string>",
 *   "userId": "<string>"
 * }
 * 
 * Authorization: Platform admin only
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function repairConversationKey(req, res) {
    const { channelId, userId } = req.body;
    const callerId = req.user?.sub; // From auth middleware

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 [AUDIT][PHASE2][TRIGGER] Repair endpoint called`);
    console.log(`   ├─ Caller: ${callerId}`);
    console.log(`   ├─ Channel: ${channelId}`);
    console.log(`   ├─ User: ${userId}`);
    console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        // Validate input
        if (!channelId || !userId) {
            console.error(`❌ [AUDIT][PHASE2][TRIGGER] Missing required fields`);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: channelId and userId'
            });
        }

        // Call repair function (5 gates will be checked inside)
        const result = await conversationKeysService.repairConversationKeyForUser(
            channelId,
            userId
        );

        // Log result
        console.log(`📊 [AUDIT][PHASE2][TRIGGER] Repair completed`);
        console.log(`   ├─ Result: ${result.result}`);
        console.log(`   └─ Reason: ${result.reason || 'N/A'}`);

        // Return result verbatim
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
            // Gate failure
            return res.status(400).json({
                success: false,
                result: result.result,
                reason: result.reason,
                message: 'Cannot repair - safety gate failed'
            });
        }

    } catch (_error) {
        console.error(`❌ [AUDIT][PHASE2][TRIGGER] Endpoint exception:`, error);
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
