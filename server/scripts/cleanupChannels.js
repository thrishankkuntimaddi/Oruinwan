// scripts/cleanupChannels.js
// Cleanup script to remove duplicate/orphaned channels and ensure workspace isolation

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');

async function cleanupChannels() {
    try {
        console.log('🔧 Starting channel cleanup...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix');
        console.log('✅ Connected to database\n');

        // 1. Find all workspaces
        const workspaces = await Workspace.find({});
        console.log(`📋 Found ${workspaces.length} workspaces\n`);

        // 2. For each workspace, show its channels
        for (const workspace of workspaces) {
            const channels = await Channel.find({ workspace: workspace._id });
            console.log(`\n📁 Workspace: ${workspace.name} (${workspace._id})`);
            console.log(`   Channels: ${channels.length}`);
            channels.forEach(ch => {
                console.log(`   - #${ch.name} ${ch.isDefault ? '(default)' : ''}`);
            });
        }

        // 3. Find channels without a workspace reference (orphaned)
        const orphanedChannels = await Channel.find({
            $or: [
                { workspace: null },
                { workspace: { $exists: false } }
            ]
        });

        if (orphanedChannels.length > 0) {
            console.log(`\n⚠️  Found ${orphanedChannels.length} orphaned channels (no workspace):`);
            orphanedChannels.forEach(ch => {
                console.log(`   - #${ch.name} (ID: ${ch._id})`);
            });

            console.log('\n🗑️  Deleting orphaned channels...');
            const result = await Channel.deleteMany({
                $or: [
                    { workspace: null },
                    { workspace: { $exists: false } }
                ]
            });
            console.log(`   ✅ Deleted ${result.deletedCount} orphaned channels`);
        }

        // 4. Find duplicate default channels in the same workspace
        console.log('\n\n🔍 Checking for duplicate default channels...');
        for (const workspace of workspaces) {
            const generalChannels = await Channel.find({
                workspace: workspace._id,
                name: 'general'
            });

            const announcementChannels = await Channel.find({
                workspace: workspace._id,
                name: 'announcements'
            });

            if (generalChannels.length > 1) {
                console.log(`\n⚠️  Workspace "${workspace.name}" has ${generalChannels.length} #general channels`);
                // Keep the oldest one, delete the rest
                const sorted = generalChannels.sort((a, b) => a.createdAt - b.createdAt);
                const toKeep = sorted[0];
                const toDelete = sorted.slice(1);

                console.log(`   Keeping: ${toKeep._id} (created ${toKeep.createdAt})`);
                for (const ch of toDelete) {
                    console.log(`   Deleting: ${ch._id} (created ${ch.createdAt})`);
                    await Channel.findByIdAndDelete(ch._id);
                }
            }

            if (announcementChannels.length > 1) {
                console.log(`\n⚠️  Workspace "${workspace.name}" has ${announcementChannels.length} #announcements channels`);
                // Keep the oldest one, delete the rest
                const sorted = announcementChannels.sort((a, b) => a.createdAt - b.createdAt);
                const toKeep = sorted[0];
                const toDelete = sorted.slice(1);

                console.log(`   Keeping: ${toKeep._id} (created ${toKeep.createdAt})`);
                for (const ch of toDelete) {
                    console.log(`   Deleting: ${ch._id} (created ${ch.createdAt})`);
                    await Channel.findByIdAndDelete(ch._id);
                }
            }
        }

        // 5. Final summary
        console.log('\n\n📊 FINAL SUMMARY\n');
        for (const workspace of workspaces) {
            const channels = await Channel.find({ workspace: workspace._id });
            console.log(`\n📁 ${workspace.name}:`);
            channels.forEach(ch => {
                console.log(`   ✓ #${ch.name} ${ch.isDefault ? '(default)' : ''}`);
            });
        }

        console.log('\n\n✅ Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run cleanup
cleanupChannels();
