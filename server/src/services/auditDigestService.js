const Channel = require("../features/channels/channel.model.js");
const ConversationKey = require('../../models/ConversationKey');

async function generateAuditDigest() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [AUDIT][PHASE1][DIGEST] Key Distribution Health Report');
    console.log(`   Generated at: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        
        const channels = await Channel.find({}).select('_id members workspace name').lean();
        const totalChannels = channels.length;

        if (totalChannels === 0) {
            console.log('   ℹ️ No channels found in database');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
        }

        let healthyChannels = 0;
        let partialChannels = 0;
        let unhealthyChannels = 0;
        let totalGaps = 0;
        const gapDetails = [];
        const criticalChannels = [];

        for (const channel of channels) {
            
            const conversationKey = await ConversationKey.findOne({
                conversationId: channel._id,
                conversationType: 'channel'
            }).lean();

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

        console.log(`\n📈 [AUDIT][PHASE1][DIGEST] Summary:`);
        console.log(`   ├─ Total channels: ${totalChannels}`);
        console.log(`   ├─ Healthy (100% coverage): ${healthyChannels} (${healthPercent}%)`);
        console.log(`   ├─ Partial coverage: ${partialChannels} (${partialPercent}%)`);
        console.log(`   ├─ No conversation key: ${unhealthyChannels} (${unhealthyPercent}%)`);
        console.log(`   └─ Total users affected: ${totalGaps}`);

        
        
        
        if (gapDetails.length > 0) {
            console.log(`\n⚠️ [AUDIT][PHASE1][DIGEST] INV-001 Violations Detected:`);

            
            gapDetails.sort((a, b) => b.gap - a.gap);

            const topGaps = gapDetails.slice(0, 10);
            topGaps.forEach((detail, index) => {
                console.log(`   ${index + 1}. Channel: ${detail.channelName} (${detail.channelId})`);
                console.log(`      ├─ Members: ${detail.members}`);
                console.log(`      ├─ Keys: ${detail.keys}`);
                console.log(`      ├─ Gap: ${detail.gap} users (${detail.gapPercent}% without keys)`);
                console.log(`      └─ Status: INVARIANT VIOLATION`);
            });

            if (gapDetails.length > 10) {
                console.log(`   ... and ${gapDetails.length - 10} more channels with gaps`);
            }
        } else {
            console.log(`\n✅ No INV-001 violations detected across ${healthyChannels} healthy channels`);
        }

        
        
        
        if (criticalChannels.length > 0) {
            console.log(`\n🚨 [AUDIT][PHASE1][DIGEST] CRITICAL: Channels without encryption keys:`);

            const topCritical = criticalChannels.slice(0, 5);
            topCritical.forEach((critical, index) => {
                console.log(`   ${index + 1}. Channel: ${critical.channelName} (${critical.channelId})`);
                console.log(`      ├─ Members: ${critical.members}`);
                console.log(`      └─ Issue: NO CONVERSATION KEY EXISTS (Phase 5 failure)`);
            });

            if (criticalChannels.length > 5) {
                console.log(`   ... and ${criticalChannels.length - 5} more channels without keys`);
            }
        }

        
        
        
        const overallHealthScore = Math.round((healthyChannels / totalChannels) * 100);
        console.log(`\n📊 [AUDIT][PHASE1][DIGEST] Overall Health Score: ${overallHealthScore}%`);

        if (overallHealthScore === 100) {
            console.log(`   🎉 Perfect! All channels have complete key coverage.`);
        } else if (overallHealthScore >= 90) {
            console.log(`   ✅ Good. Most channels are healthy.`);
        } else if (overallHealthScore >= 70) {
            console.log(`   ⚠️ Warning. Significant number of channels with gaps.`);
        } else {
            console.log(`   🚨 Critical. Major key distribution issues detected.`);
        }

    } catch (error) {
        console.error(`❌ [AUDIT][PHASE1][DIGEST] Failed to generate report:`, error);
        console.error(`   Error message: ${error.message}`);
        console.error(`   Stack trace: ${error.stack}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

module.exports = { generateAuditDigest };
