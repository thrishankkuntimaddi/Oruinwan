// Deep analysis of workspace-channel relationships and orphaned data
require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');

async function analyzeDatabase() {
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  🔍 DATABASE INTEGRITY ANALYSIS');
        console.log('═══════════════════════════════════════════════════════\n');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // 1. Get all workspaces
        const workspaces = await Workspace.find({}).lean();
        console.log(`📁 WORKSPACES: Found ${workspaces.length} workspace(s)\n`);

        const workspaceIds = new Set(workspaces.map(w => w._id.toString()));

        if (workspaces.length > 0) {
            console.log('Workspace List:');
            workspaces.forEach((ws, idx) => {
                console.log(`  ${idx + 1}. ${ws.name}`);
                console.log(`     ID: ${ws._id}`);
                console.log(`     Members: ${ws.members?.length || 0}`);
                console.log(`     Created: ${ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : 'Unknown'}`);
            });
            console.log('');
        }

        // 2. Get all channels
        const channels = await Channel.find({}).lean();
        console.log(`📺 CHANNELS: Found ${channels.length} channel(s)\n`);

        // 3. Categorize channels
        const orphanedChannels = [];
        const validChannels = [];
        const channelsByWorkspace = {};

        for (const channel of channels) {
            const workspaceId = channel.workspace?.toString();

            if (!workspaceId || !workspaceIds.has(workspaceId)) {
                orphanedChannels.push(channel);
            } else {
                validChannels.push(channel);
                if (!channelsByWorkspace[workspaceId]) {
                    channelsByWorkspace[workspaceId] = [];
                }
                channelsByWorkspace[workspaceId].push(channel);
            }
        }

        // 4. Report findings
        console.log('═══════════════════════════════════════════════════════');
        console.log('  📊 FINDINGS');
        console.log('═══════════════════════════════════════════════════════\n');

        console.log(`✅ Valid Channels: ${validChannels.length}`);
        console.log(`❌ Orphaned Channels: ${orphanedChannels.length}\n`);

        if (orphanedChannels.length > 0) {
            console.log('⚠️  ORPHANED CHANNELS (no matching workspace):\n');
            orphanedChannels.forEach((channel, idx) => {
                console.log(`  ${idx + 1}. #${channel.name}`);
                console.log(`     Channel ID: ${channel._id}`);
                console.log(`     Referenced Workspace ID: ${channel.workspace || 'NULL'}`);
                console.log(`     Created: ${channel.createdAt ? new Date(channel.createdAt).toLocaleDateString() : 'Unknown'}`);
                console.log(`     Members: ${channel.members?.length || 0}`);
            });
            console.log('');
        }

        // 5. Analyze workspace-channel relationships
        if (workspaces.length > 0) {
            console.log('═══════════════════════════════════════════════════════');
            console.log('  🔗 WORKSPACE-CHANNEL RELATIONSHIPS');
            console.log('═══════════════════════════════════════════════════════\n');

            for (const workspace of workspaces) {
                const wsId = workspace._id.toString();
                const wsChannels = channelsByWorkspace[wsId] || [];

                console.log(`📁 ${workspace.name}`);
                console.log(`   Channels: ${wsChannels.length}`);

                if (wsChannels.length > 0) {
                    wsChannels.forEach(ch => {
                        const defaultMarker = ch.isDefault ? ' [DEFAULT]' : '';
                        const privateMarker = ch.isPrivate ? ' 🔒' : '';
                        console.log(`   - #${ch.name}${defaultMarker}${privateMarker} (${ch.members?.length || 0} members)`);
                    });
                } else {
                    console.log('   ⚠️  No channels found!');
                }
                console.log('');
            }
        }

        // 6. Check for orphaned messages
        console.log('═══════════════════════════════════════════════════════');
        console.log('  💬 MESSAGE ANALYSIS');
        console.log('═══════════════════════════════════════════════════════\n');

        const totalMessages = await Message.countDocuments({});
        console.log(`Total Messages: ${totalMessages}`);

        if (orphanedChannels.length > 0) {
            const orphanedChannelIds = orphanedChannels.map(c => c._id);
            const orphanedMessages = await Message.countDocuments({
                channel: { $in: orphanedChannelIds }
            });
            console.log(`Messages in Orphaned Channels: ${orphanedMessages}`);
        }

        console.log('');

        // 7. Root cause analysis
        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎯 ROOT CAUSE ANALYSIS');
        console.log('═══════════════════════════════════════════════════════\n');

        if (orphanedChannels.length > 0) {
            console.log('❌ DATA INTEGRITY ISSUE DETECTED!\n');
            console.log('Possible causes:');
            console.log('  1. Workspaces were deleted but channels were not cleaned up');
            console.log('  2. Cascade delete not implemented properly');
            console.log('  3. Manual database manipulation');
            console.log('  4. Failed workspace deletion transactions\n');

            console.log('Recommended actions:');
            console.log('  1. Implement cascade delete for workspace deletion');
            console.log('  2. Clean up orphaned channels');
            console.log('  3. Add database constraints/indexes');
            console.log('  4. Create cleanup script for orphaned data\n');
        } else if (workspaces.length === 0 && channels.length > 0) {
            console.log('❌ CRITICAL ISSUE: Channels exist but NO workspaces!\n');
            console.log('This indicates all workspaces have been deleted.');
            console.log('All channels are orphaned and should be removed.\n');
        } else if (workspaces.length === 0 && channels.length === 0) {
            console.log('✅ Database is clean (no workspaces, no channels)\n');
        } else {
            console.log('✅ All channels have valid workspace references\n');
            console.log('Database integrity check PASSED!\n');
        }

        await mongoose.disconnect();
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

analyzeDatabase();
