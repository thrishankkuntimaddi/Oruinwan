const mongoose = require('mongoose');
const Message = require("../src/features/messages/message.model.js");
require('dotenv').config();

async function setLastReplyAt() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        
        const messagesWithReplies = await Message.find({
            replyCount: { $gt: 0 },
            parentId: null
        });

        console.log(`📊 Found ${messagesWithReplies.length} parent messages with replies\n`);

        let updated = 0;

        for (const parentMsg of messagesWithReplies) {
            
            const mostRecentReply = await Message.findOne({
                parentId: parentMsg._id
            })
                .sort({ createdAt: -1 })
                .select('createdAt')
                .lean();

            if (mostRecentReply) {
                
                await Message.findByIdAndUpdate(parentMsg._id, {
                    $set: { lastReplyAt: mostRecentReply.createdAt }
                });

                console.log(`✅ Updated ${parentMsg._id}: lastReplyAt = ${mostRecentReply.createdAt}`);
                updated++;
            } else {
                console.log(`⚠️  No replies found for message ${parentMsg._id} (replyCount: ${parentMsg.replyCount})`);
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   - Updated: ${updated} messages`);

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

setLastReplyAt();
