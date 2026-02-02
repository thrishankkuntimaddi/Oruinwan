// server/scripts/fix-thread-counts.js
/**
 * Database Migration Script
 * 
 * Problem: Old messages created before thread system was fully implemented
 * don't have the replyCount field populated, even though they have replies.
 * 
 * Solution: Count actual replies (messages withparentId) and update parent messages.
 */

const mongoose = require('mongoose');
const Message = require("../src/features/messages/message.model.js");
require('dotenv').config();

async function fixThreadCounts() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all messages that have replies (have children with parentId pointing to them)
        const messagesWithReplies = await Message.aggregate([
            {
                $match: {
                    parentId: { $ne: null } // Find all reply messages
                }
            },
            {
                $group: {
                    _id: '$parentId', // Group by parent message ID
                    replyCount: { $sum: 1 } // Count replies
                }
            }
        ]);

        console.log(`\n📊 Found ${messagesWithReplies.length} parent messages with replies`);

        let updated = 0;
        let skipped = 0;

        for (const item of messagesWithReplies) {
            const parentId = item._id;
            const actualCount = item.replyCount;

            // Get current parent message
            const parent = await Message.findById(parentId);

            if (!parent) {
                console.log(`⚠️  Parent message ${parentId} not found (orphaned replies)`);
                continue;
            }

            const currentCount = parent.replyCount || 0;

            if (currentCount !== actualCount) {
                // Update the replyCount
                await Message.findByIdAndUpdate(parentId, {
                    $set: { replyCount: actualCount }
                });

                console.log(`✅ Updated message ${parentId}: ${currentCount} → ${actualCount} replies`);
                updated++;
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   - Updated: ${updated} messages`);
        console.log(`   - Skipped (already correct): ${skipped} messages`);
        console.log(`   - Total processed: ${messagesWithReplies.length} messages`);

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
fixThreadCounts();
