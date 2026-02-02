// server/scripts/check-thread-channels.js
/**
 * Check which channels the updated thread messages belong to
 */

const mongoose = require('mongoose');
const Message = require("../src/features/messages/message.model.js");
require('dotenv').config();

async function checkThreadChannels() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // IDs from the migration that was run
        const updatedMessageIds = [
            '69801901159e8c7292ebfb01',
            '6980190f159e8c7292ebfb90',
            '69801911159e8c7292ebfb97',
            '698023e0887eeb2c375ff8d1'
        ];

        console.log('📊 Checking channels for updated thread messages:\n');

        for (const id of updatedMessageIds) {
            const message = await Message.findById(id).lean();

            if (message) {
                console.log(`Message ID: ${id}`);
                console.log(`  Channel: ${message.channel || 'null (DM message)'}`);
                console.log(`  DM: ${message.dm || 'null'}`);
                console.log(`  Reply Count: ${message.replyCount || 0}`);
                console.log(`  Parent ID: ${message.parentId || 'null (parent message)'}`);
                console.log('');
            } else {
                console.log(`❌ Message ${id} not found\n`);
            }
        }

        // Now check the specific channel the user is viewing
        const userChannel = '698018d5159e8c7292ebfa25';
        console.log(`\n🔍 Checking threads in user's current channel: ${userChannel}\n`);

        const threadsInChannel = await Message.find({
            channel: userChannel,
            replyCount: { $gt: 0 },
            parentId: null
        }).lean();

        console.log(`Found ${threadsInChannel.length} threads in channel ${userChannel}`);

        if (threadsInChannel.length > 0) {
            threadsInChannel.forEach(msg => {
                console.log(`  - Message ${msg._id}: ${msg.replyCount} replies`);
            });
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkThreadChannels();
