// Script to fix company workspaces with incorrect channel names
// Renames 'announcement' (singular) to 'announcements' (plural) to match convention

require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');

async function fixChannelNames() {
    try {
        // Connect to database
        const dbUri = process.env.MONGO_URI;
        if (!dbUri) {
            console.error('❌ MONGO_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database');

        // Find all channels named 'announcement' (singular) that are default channels
        const incorrectChannels = await Channel.find({
            name: 'announcement',
            isDefault: true
        });

        console.log(`Found ${incorrectChannels.length} channels with incorrect name 'announcement'`);

        let fixedCount = 0;
        for (const channel of incorrectChannels) {
            // Check if workspace already has a channel named 'announcements'
            const existingCorrect = await Channel.findOne({
                workspace: channel.workspace,
                name: 'announcements',
                isDefault: true
            });

            if (existingCorrect) {
                // Workspace already has correct channel - delete the incorrect one
                console.log(`❌ Deleting duplicate 'announcement' channel for workspace ${channel.workspace}`);
                await Channel.findByIdAndDelete(channel._id);

                // Remove from workspace defaultChannels if present
                await Workspace.updateOne(
                    { _id: channel.workspace },
                    { $pull: { defaultChannels: channel._id } }
                );
            } else {
                // Simply rename the channel
                channel.name = 'announcements';
                await channel.save();
                console.log(`✅ Renamed channel ${channel._id} to 'announcements' for workspace ${channel.workspace}`);
                fixedCount++;
            }
        }

        console.log(`\n✅ Migration complete!`);
        console.log(`   - Fixed ${fixedCount} channels`);
        console.log(`   - Deleted ${incorrectChannels.length - fixedCount} duplicate channels`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    fixChannelNames();
}

module.exports = fixChannelNames;
