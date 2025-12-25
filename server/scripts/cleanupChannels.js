const mongoose = require('mongoose');
require('dotenv').config();

const Channel = require('../models/Channel');

async function cleanupChannels() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all non-default channels
        const nonDefaultChannels = await Channel.find({
            isDefault: { $ne: true }
        });

        console.log(`📊 Found ${nonDefaultChannels.length} non-default channels:\n`);

        nonDefaultChannels.forEach((channel, idx) => {
            console.log(`${idx + 1}. #${channel.name} (ID: ${channel._id})`);
            console.log(`   - Workspace: ${channel.workspace}`);
            console.log(`   - Private: ${channel.isPrivate}`);
            console.log(`   - Members: ${channel.members.length}`);
        });

        if (nonDefaultChannels.length === 0) {
            console.log('\n✨ No non-default channels to delete!');
            await mongoose.disconnect();
            return;
        }

        console.log('\n🗑️  Deleting non-default channels...');

        const result = await Channel.deleteMany({
            isDefault: { $ne: true }
        });

        console.log(`✅ Successfully deleted ${result.deletedCount} channels!\n`);

        // Show remaining channels
        const remainingChannels = await Channel.find({});
        console.log(`📌 Remaining channels (${remainingChannels.length}):`);
        remainingChannels.forEach((channel, idx) => {
            console.log(`${idx + 1}. #${channel.name} (Default: ${channel.isDefault})`);
        });

        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        console.log('✨ Cleanup complete!');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
        process.exit(1);
    }
}

cleanupChannels();
