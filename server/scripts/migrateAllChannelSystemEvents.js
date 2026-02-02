// server/scripts/migrateAllChannelSystemEvents.js
/**
 * Migration Script: Add systemEvents to ALL existing channels
 * 
 * This script adds 'channel_created' systemEvents to all channels
 * that are missing them (both default and user-created channels).
 * 
 * Usage: node scripts/migrateAllChannelSystemEvents.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require("../src/features/channels/channel.model.js");

async function migrateAllChannelSystemEvents() {
    try {
        console.log('🚀 Starting migration: Add systemEvents to ALL channels...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find ALL channels without systemEvents or with empty systemEvents
        const channelsToMigrate = await Channel.find({
            $or: [
                { systemEvents: { $exists: false } },
                { systemEvents: { $size: 0 } }
            ]
        }).lean();

        console.log(`📊 Found ${channelsToMigrate.length} channels to migrate\n`);

        if (channelsToMigrate.length === 0) {
            console.log('✅ No channels need migration. All channels already have systemEvents!\n');
            await mongoose.connection.close();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Process each channel
        for (const channel of channelsToMigrate) {
            try {
                // Use the channel's creation timestamp
                const timestamp = channel.createdAt || new Date();
                const userId = channel.createdBy;

                // Update the channel with systemEvents
                await Channel.findByIdAndUpdate(
                    channel._id,
                    {
                        $set: {
                            systemEvents: [{
                                type: 'channel_created',
                                userId: userId,
                                timestamp: timestamp
                            }]
                        }
                    }
                );

                console.log(`✅ Migrated: #${channel.name} (created on ${timestamp.toLocaleDateString()})`);
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
        console.log('💡 Tip: Refresh your browser to see "Channel created on <date>" for all channels.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
migrateAllChannelSystemEvents()
    .then(() => {
        console.log('\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
