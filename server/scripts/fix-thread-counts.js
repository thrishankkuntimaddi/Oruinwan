const mongoose = require('mongoose');
const Message = require("../src/features/messages/message.model.js");
require('dotenv').config();

async function fixThreadCounts() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        
        const messagesWithReplies = await Message.aggregate([
            {
                $match: {
                    parentId: { $ne: null } 
                }
            },
            {
                $group: {
                    _id: '$parentId', 
                    replyCount: { $sum: 1 } 
                }
            }
        ]);

        console.log(`\n📊 Found ${messagesWithReplies.length} parent messages with replies`);

        let updated = 0;
        let skipped = 0;

        for (const item of messagesWithReplies) {
            const parentId = item._id;
            const actualCount = item.replyCount;

            
            const parent = await Message.findById(parentId);

            if (!parent) {
                console.log(`⚠️  Parent message ${parentId} not found (orphaned replies)`);
                continue;
            }

            const currentCount = parent.replyCount || 0;

            if (currentCount !== actualCount) {
                
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

fixThreadCounts();
