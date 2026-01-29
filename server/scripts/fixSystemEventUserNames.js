// server/scripts/fixSystemEventUserNames.js
/**
 * Direct MongoDB Update: Add userName to systemEvents
 * This uses direct MongoDB operations to ensure the update works
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function fixSystemEventUserNames() {
    try {
        console.log('🚀 Starting direct MongoDB update...\\n');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\\n');

        const db = mongoose.connection.db;
        const channelsCollection = db.collection('channels');
        const usersCollection = db.collection('users');

        // Find all channels with systemEvents
        const channels = await channelsCollection.find({
            'systemEvents.0': { $exists: true }
        }).toArray();

        console.log(`📊 Found ${channels.length} channels with systemEvents\\n`);

        let updatedCount = 0;

        for (const channel of channels) {
            let updated = false;

            // Update each systemEvent
            for (const event of channel.systemEvents) {
                if (event.userId && !event.userName) {
                    // Fetch user
                    const user = await usersCollection.findOne(
                        { _id: event.userId },
                        { projection: { firstName: 1, lastName: 1, username: 1 } }
                    );

                    if (user) {
                        event.userName = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
                        updated = true;
                    }
                }
            }

            // Save back to database with direct update
            if (updated) {
                await channelsCollection.updateOne(
                    { _id: channel._id },
                    { $set: { systemEvents: channel.systemEvents } }
                );
                console.log(`✅ Updated: #${channel.name}`);
                updatedCount++;
            }
        }

        console.log('\\n' + '='.repeat(60));
        console.log(`✅ Successfully updated ${updatedCount} channels`);
        console.log('='.repeat(60) + '\\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

fixSystemEventUserNames()
    .then(() => {
        console.log('\\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\\n💥 Fatal error:', error);
        process.exit(1);
    });
