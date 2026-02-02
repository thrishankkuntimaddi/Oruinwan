// server/scripts/migrateChannelSystemEvents.js
/**
 * Migration Script: Add systemEvents to existing default channels
 * 
 * This script safely adds 'channel_created' systemEvents to all default channels
 * that are missing them, without modifying any existing data.
 * 
 * Usage: node scripts/migrateChannelSystemEvents.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require("../src/features/channels/channel.model.js");

async function migrateChannelSystemEvents() {
    try {
        console.log('🚀 Starting migration: Add systemEvents to default channels...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all default channels without systemEvents or with empty systemEvents
        const channelsToMigrate = await Channel.find({
            isDefault: true,
            $or: [
                { systemEvents: { $exists: false } },
                { systemEvents: { $size: 0 } }
            ]
        }).populate('createdBy', 'username');

        console.log(`📊 Found ${channelsToMigrate.length} default channels to migrate\n`);

        if (channelsToMigrate.length === 0) {
            console.log('✅ No channels need migration. All default channels already have systemEvents!\n');
            await mongoose.connection.close();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Process each channel
        for (const channel of channelsToMigrate) {
            try {
                // Use the channel's creation timestamp or first member's joinedAt
                const timestamp = channel.createdAt ||
                    (channel.members[0]?.joinedAt) ||
                    new Date();

                const userId = channel.createdBy;

                // Add channel_created event
                channel.systemEvents = [{
                    type: 'channel_created',
                    userId: userId,
                    timestamp: timestamp
                }];

                await channel.save();

                const creatorName = channel.createdBy?.username || 'Unknown';
                console.log(`✅ Migrated: #${channel.name} (created by ${creatorName} on ${timestamp.toLocaleDateString()})`);
                successCount++;

            } catch (error) {
                console.error(`❌ Error migrating channel #${channel.name}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Migration Summary:');
        console.log(`   ✅ Successfully migrated: ${successCount} channels`);
        console.log(`   ❌ Failed: ${errorCount} channels`);
        console.log(`   📊 Total processed: ${channelsToMigrate.length} channels`);
        console.log('='.repeat(60) + '\n');

        console.log('✅ Migration completed successfully!\n');
        console.log('💡 Tip: Refresh your browser to see the updated channel creation messages.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
migrateChannelSystemEvents()
    .then(() => {
        console.log('\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
