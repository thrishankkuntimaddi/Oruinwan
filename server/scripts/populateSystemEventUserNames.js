require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require("../src/features/channels/channel.model.js");
const User = require('../models/User');

async function populateSystemEventUserNames() {
    try {
        console.log('🚀 Starting migration: Populate userName in systemEvents...\n');

        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        
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

        
        for (const channel of channels) {
            let needsUpdate = false;

            
            for (const event of channel.systemEvents) {
                if (event.userId && !event.userName) {
                    
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

populateSystemEventUserNames()
    .then(() => {
        console.log('\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
