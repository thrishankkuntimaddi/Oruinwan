// scripts/fixDefaultChannels.js
// This script ensures each workspace has one and only one #general and #announcements channel

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');

async function fixDefaultChannels() {
    try {
        console.log('🔧 Fixing default channels...\n');

        // Connect to database
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to database\n');

        // Get all workspaces
        const workspaces = await Workspace.find({});
        console.log(`📋 Found ${workspaces.length} workspaces\n`);

        for (const workspace of workspaces) {
            console.log(`\n🏢 Processing workspace: ${workspace.name} (${workspace._id})`);

            // Get all members of this workspace
            const memberIds = workspace.members.map(m => m.user);
            console.log(`   Members: ${memberIds.length}`);

            // Check for #general channels in this workspace
            const generalChannels = await Channel.find({
                workspace: workspace._id,
                name: 'general'
            });

            console.log(`   Found ${generalChannels.length} #general channels`);

            if (generalChannels.length === 0) {
                // Create #general
                console.log('   ➕ Creating #general...');
                await Channel.create({
                    workspace: workspace._id,
                    company: workspace.company || null,
                    name: 'general',
                    description: 'General discussion',
                    isPrivate: false,
                    isDefault: true,
                    createdBy: workspace.createdBy,
                    members: memberIds
                });
                console.log('   ✅ Created #general');
            } else if (generalChannels.length > 1) {
                // Keep oldest, delete rest
                console.log(`   ⚠️  Multiple #general channels found. Keeping oldest...`);
                const sorted = generalChannels.sort((a, b) => a.createdAt - b.createdAt);
                const toKeep = sorted[0];
                const toDelete = sorted.slice(1);

                // Update the keeper to have all workspace members
                toKeep.members = [...new Set([...toKeep.members, ...memberIds])];
                await toKeep.save();
                console.log(`   ✅ Updated #general with all members`);

                for (const ch of toDelete) {
                    console.log(`   🗑️  Deleting duplicate: ${ch._id} (created ${ch.createdAt})`);
                    await Channel.findByIdAndDelete(ch._id);
                }
            } else {
                // Update existing to ensure all members
                console.log('   ✅ #general exists, updating members...');
                const general = generalChannels[0];
                general.members = [...new Set([...general.members, ...memberIds])];
                await general.save();
            }

            // Check for #announcements channels in this workspace
            const announcementChannels = await Channel.find({
                workspace: workspace._id,
                name: 'announcements'
            });

            console.log(`   Found ${announcementChannels.length} #announcements channels`);

            if (announcementChannels.length === 0) {
                // Create #announcements
                console.log('   ➕ Creating #announcements...');
                await Channel.create({
                    workspace: workspace._id,
                    company: workspace.company || null,
                    name: 'announcements',
                    description: 'Announcements and updates',
                    isPrivate: false,
                    isDefault: true,
                    createdBy: workspace.createdBy,
                    members: memberIds
                });
                console.log('   ✅ Created #announcements');
            } else if (announcementChannels.length > 1) {
                // Keep oldest, delete rest
                console.log(`   ⚠️  Multiple #announcements channels found. Keeping oldest...`);
                const sorted = announcementChannels.sort((a, b) => a.createdAt - b.createdAt);
                const toKeep = sorted[0];
                const toDelete = sorted.slice(1);

                // Update the keeper to have all workspace members
                toKeep.members = [...new Set([...toKeep.members, ...memberIds])];
                await toKeep.save();
                console.log(`   ✅ Updated #announcements with all members`);

                for (const ch of toDelete) {
                    console.log(`   🗑️  Deleting duplicate: ${ch._id} (created ${ch.createdAt})`);
                    await Channel.findByIdAndDelete(ch._id);
                }
            } else {
                // Update existing to ensure all members
                console.log('   ✅ #announcements exists, updating members...');
                const announcements = announcementChannels[0];
                announcements.members = [...new Set([...announcements.members, ...memberIds])];
                await announcements.save();
            }
        }

        // Delete orphaned channels (channels without a workspace)
        const orphaned = await Channel.find({
            $or: [
                { workspace: null },
                { workspace: { $exists: false } }
            ]
        });

        if (orphaned.length > 0) {
            console.log(`\n⚠️  Found ${orphaned.length} orphaned channels (no workspace):`);
            orphaned.forEach(ch => console.log(`   - #${ch.name} (ID: ${ch._id})`));

            await Channel.deleteMany({
                $or: [
                    { workspace: null },
                    { workspace: { $exists: false } }
                ]
            });
            console.log(`   ✅ Deleted all orphaned channels`);
        }

        // Final summary
        console.log('\n\n' + '='.repeat(60));
        console.log('📊 FINAL STATE');
        console.log('='.repeat(60));

        for (const workspace of workspaces) {
            const channels = await Channel.find({ workspace: workspace._id });
            console.log(`\n📁 ${workspace.name} (${workspace._id}):`);
            console.log(`   Total channels: ${channels.length}`);
            channels.forEach(ch => {
                console.log(`   ✓ #${ch.name} ${ch.isDefault ? '(default)' : '(custom)'} - ${ch.members.length} members`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All workspaces fixed!');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixDefaultChannels();
