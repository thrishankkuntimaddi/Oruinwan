// server/scripts/populateSystemEventUserNames.js
/**
 * Migration Script: Populate userName in systemEvents
 * 
 * This script adds the userName field to all systemEvents that have a userId
 * but are missing the userName field.
 * 
 * Usage: node scripts/populateSystemEventUserNames.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const User = require('../models/User');

async function populateSystemEventUserNames() {
    try {
        console.log('🚀 Starting migration: Populate userName in systemEvents...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find ALL channels with systemEvents
        const channels = await Channel.find({
            'systemEvents.0': { $exists: true }
        });

        console.log(`📊 Found ${channels.length} channels with systemEvents\n`);

        if (channels.length === 0) {
            console.log('✅ No channels with systemEvents found!\n');
            await mongoose.connection.close();
            return;
        }

        let updatedCount = 0;
        let skippedCount = 0;

        // Process each channel
        for (const channel of channels) {
            let needsUpdate = false;

            // Check each systemEvent
            for (const event of channel.systemEvents) {
                if (event.userId && !event.userName) {
                    // Fetch user and add userName
                    const user = await User.findById(event.userId).select('firstName lastName').lean();
                    if (user) {
                        event.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                await channel.save();
                console.log(`✅ Updated: #${channel.name} - populated ${channel.systemEvents.length} events`);
                updatedCount++;
            } else {
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Migration Summary:');
        console.log(`   ✅ Updated: ${updatedCount} channels`);
        console.log(`   ⏭️  Skipped (already populated): ${skippedCount} channels`);
        console.log(`   📊 Total processed: ${channels.length} channels`);
        console.log('='.repeat(60) + '\n');

        console.log('✅ Migration completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
populateSystemEventUserNames()
    .then(() => {
        console.log('\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
