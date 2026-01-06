// Migration script to update Channel members from old format to new format
// Run this once to migrate existing channel data

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('./models/Channel');

async function migrateChannelMembers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all channels with old member format (array of ObjectIds)
        const channels = await Channel.find({});

        let migrated = 0;
        let skipped = 0;

        for (const channel of channels) {
            // Check if members array has old format
            if (channel.members.length > 0) {
                const firstMember = channel.members[0];

                // If first member is ObjectId (not an object), migrate
                if (!firstMember.user && !firstMember.joinedAt) {
                    console.log(`Migrating channel: ${channel.name} (${channel._id})`);

                    // Convert plain ObjectIds to new format
                    channel.members = channel.members.map(memberId => ({
                        user: memberId,
                        joinedAt: channel.createdAt || new Date() // Use channel creation date as fallback
                    }));

                    await channel.save();
                    migrated++;
                } else {
                    skipped++;
                }
            }
        }

        console.log(`\nMigration complete!`);
        console.log(`Migrated: ${migrated} channels`);
        console.log(`Skipped: ${skipped} channels (already in new format)`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

// Run migration
if (require.main === module) {
    migrateChannelMembers();
}

module.exports = migrateChannelMembers;
