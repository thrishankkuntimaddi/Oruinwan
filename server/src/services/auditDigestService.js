const logger = require('../../utils/logger');
const Channel = require("../features/channels/channel.model.js");
const { conversationKeys } = require('../identity');

async function generateAuditDigest() {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('📊 [AUDIT][PHASE1][DIGEST] Key Distribution Health Report');
    logger.info(`   Generated at: ${new Date().toISOString()}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        
        const channels = await Channel.find({}).select('_id members workspace name').lean();
        const totalChannels = channels.length;

        if (totalChannels === 0) {
            logger.info('   ℹ️ No channels found in database');
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
        }

        let healthyChannels = 0;
        let partialChannels = 0;
        let unhealthyChannels = 0;
        let totalGaps = 0;
        const gapDetails = [];
        const criticalChannels = [];

        for (const channel of channels) {
            
            const conversationKey = await conversationKeys.findByConversation(channel._id, 'channel');

            if (!conversationKey) {
                
                unhealthyChannels++;
                criticalChannels.push({
                    channelId: channel._id,
                    channelName: channel.name || 'Unknown',
                    issue: 'NO_CONVERSATION_KEY',
                    members: channel.members.length
                });
                continue;
            }

            const memberCount = channel.members.length;
            const keyCount = conversationKey.encryptedKeys.length;
            const gap = memberCount - keyCount;

            if (gap === 0) {
                
                healthyChannels++;
            } else if (gap > 0) {
                
                
                

                if (keyCount === 0 && memberCount > 0) {
                    
                    healthyChannels++; 
                    continue; 
                }

                
                partialChannels++;
                totalGaps += gap;
                gapDetails.push({
                    channelId: channel._id,
                    channelName: channel.name || 'Unknown',
                    members: memberCount,
                    keys: keyCount,
                    gap: gap,
                    gapPercent: Math.round((gap / memberCount) * 100)
                });
            }
            
            
        }

        
        
        
        const healthPercent = Math.round((healthyChannels / totalChannels) * 100);
        const partialPercent = Math.round((partialChannels / totalChannels) * 100);
        const unhealthyPercent = Math.round((unhealthyChannels / totalChannels) * 100);

        logger.info(`\n📈 [AUDIT][PHASE1][DIGEST] Summary:`);
        logger.info(`   ├─ Total channels: ${totalChannels}`);
        logger.info(`   ├─ Healthy (100% coverage): ${healthyChannels} (${healthPercent}%)`);
        logger.info(`   ├─ Partial coverage: ${partialChannels} (${partialPercent}%)`);
        logger.info(`   ├─ No conversation key: ${unhealthyChannels} (${unhealthyPercent}%)`);
        logger.info(`   └─ Total users affected: ${totalGaps}`);

        
        
        
        if (gapDetails.length > 0) {
            logger.info(`\n⚠️ [AUDIT][PHASE1][DIGEST] INV-001 Violations Detected:`);

            
            gapDetails.sort((a, b) => b.gap - a.gap);

            const topGaps = gapDetails.slice(0, 10);
            topGaps.forEach((detail, index) => {
                logger.info(`   ${index + 1}. Channel: ${detail.channelName} (${detail.channelId})`);
                logger.info(`      ├─ Members: ${detail.members}`);
                logger.info(`      ├─ Keys: ${detail.keys}`);
                logger.info(`      ├─ Gap: ${detail.gap} users (${detail.gapPercent}% without keys)`);
                logger.info(`      └─ Status: INVARIANT VIOLATION`);
            });

            if (gapDetails.length > 10) {
                logger.info(`   ... and ${gapDetails.length - 10} more channels with gaps`);
            }
        } else {
            logger.info(`\n✅ No INV-001 violations detected across ${healthyChannels} healthy channels`);
        }

        
        
        
        if (criticalChannels.length > 0) {
            logger.info(`\n🚨 [AUDIT][PHASE1][DIGEST] CRITICAL: Channels without encryption keys:`);

            const topCritical = criticalChannels.slice(0, 5);
            topCritical.forEach((critical, index) => {
                logger.info(`   ${index + 1}. Channel: ${critical.channelName} (${critical.channelId})`);
                logger.info(`      ├─ Members: ${critical.members}`);
                logger.info(`      └─ Issue: NO CONVERSATION KEY EXISTS (Phase 5 failure)`);
            });

            if (criticalChannels.length > 5) {
                logger.info(`   ... and ${criticalChannels.length - 5} more channels without keys`);
            }
        }

        
        
        
        const overallHealthScore = Math.round((healthyChannels / totalChannels) * 100);
        logger.info(`\n📊 [AUDIT][PHASE1][DIGEST] Overall Health Score: ${overallHealthScore}%`);

        if (overallHealthScore === 100) {
            logger.info(`   🎉 Perfect! All channels have complete key coverage.`);
        } else if (overallHealthScore >= 90) {
            logger.info(`   ✅ Good. Most channels are healthy.`);
        } else if (overallHealthScore >= 70) {
            logger.info(`   ⚠️ Warning. Significant number of channels with gaps.`);
        } else {
            logger.info(`   🚨 Critical. Major key distribution issues detected.`);
        }

    } catch (error) {
        logger.error(`❌ [AUDIT][PHASE1][DIGEST] Failed to generate report:`, error);
        logger.error(`   Error message: ${error.message}`);
        logger.error(`   Stack trace: ${error.stack}`);
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

module.exports = { generateAuditDigest };
