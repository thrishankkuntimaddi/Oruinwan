// Clear all data from general and announcements channels for fresh testing
require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const Message = require('../models/Message');

async function clearChannelData() {
    try {
        console.log('\n═══════════════════════════════════════════');
        console.log('  🧹 Clear General & Announcements Channels');
        console.log('═══════════════════════════════════════════\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find general and announcements channels across all workspaces
        const channelsToClean = await Channel.find({
            name: { $in: ['general', 'announcements'] }
        }).lean();

        console.log(`📋 Found ${channelsToClean.length} channels to clean:\n`);

        if (channelsToClean.length === 0) {
            console.log('✨ No channels found to clean!');
            await mongoose.disconnect();
            return;
        }

        // Display channels
        channelsToClean.forEach((channel, idx) => {
            console.log(`  ${idx + 1}. #${channel.name} (ID: ${channel._id})`);
            console.log(`     Workspace: ${channel.workspace}`);
            console.log(`     Private: ${channel.isPrivate}`);
            console.log(`     Members: ${channel.members.length}`);
        });
        console.log('');

        // Get channel IDs
        const channelIds = channelsToClean.map(c => c._id);

        // Count messages to be deleted
        const messageCount = await Message.countDocuments({
            channel: { $in: channelIds }
        });

        console.log(`💬 Found ${messageCount} messages to delete\n`);

        if (messageCount === 0) {
            console.log('✨ No messages to delete!');
            await mongoose.disconnect();
            return;
        }

        // Delete all messages
        console.log('🗑️  Deleting all messages from these channels...\n');

        const result = await Message.deleteMany({
            channel: { $in: channelIds }
        });

        console.log(`✅ Successfully deleted ${result.deletedCount} message(s)!\n`);

        // Show summary
        console.log('📊 Summary:');
        console.log(`   Channels cleaned: ${channelsToClean.length}`);
        console.log(`   Messages deleted: ${result.deletedCount}`);
        console.log('');

        // Optionally reset channel state (last message, etc)
        for (const channel of channelsToClean) {
            await Channel.findByIdAndUpdate(channel._id, {
                $unset: { lastMessage: "" }
            });
        }
        console.log('✅ Reset channel states\n');

        await mongoose.disconnect();
        console.log('═══════════════════════════════════════════');
        console.log('  ✅ Cleanup Complete!');
        console.log('═══════════════════════════════════════════');
        console.log('\n🎯 Channels are now ready for fresh testing!\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

clearChannelData();
