// Nuclear option: Delete ALL workspaces, channels, and messages
require('dotenv').config();
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Message = require('../models/Message');

const CONFIRM_DELETE = true; // Set to true to actually delete

async function nukeDatabase() {
    try {
        console.log('\n═══════════════════════════════════════════');
        console.log('  ☢️  NUCLEAR DATABASE CLEANUP');
        console.log('═══════════════════════════════════════════\n');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Count everything first
        const workspaceCount = await Workspace.countDocuments({});
        const channelCount = await Channel.countDocuments({});
        const messageCount = await Message.countDocuments({});

        console.log('📊 Current Database State:');
        console.log(`   Workspaces: ${workspaceCount}`);
        console.log(`   Channels: ${channelCount}`);
        console.log(`   Messages: ${messageCount}\n`);

        if (workspaceCount === 0 && channelCount === 0 && messageCount === 0) {
            console.log('✨ Database is already empty!\n');
            await mongoose.disconnect();
            return;
        }

        if (!CONFIRM_DELETE) {
            console.log('⚠️  PREVIEW MODE');
            console.log('═══════════════════════════════════════════\n');
            console.log('This will DELETE:');
            console.log(`  ❌ ${workspaceCount} workspace(s)`);
            console.log(`  ❌ ${channelCount} channel(s)`);
            console.log(`  ❌ ${messageCount} message(s)\n`);
            console.log('To execute deletion:');
            console.log('  1. Edit this script');
            console.log('  2. Set CONFIRM_DELETE = true');
            console.log('  3. Run again\n');
            await mongoose.disconnect();
            return;
        }

        console.log('⚠️  DELETE MODE ACTIVE!');
        console.log('═══════════════════════════════════════════\n');
        console.log('Deleting in 3 seconds...\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Delete in order: Messages -> Channels -> Workspaces
        console.log('🗑️  Step 1/3: Deleting messages...');
        const messagesResult = await Message.deleteMany({});
        console.log(`   ✅ Deleted ${messagesResult.deletedCount} message(s)\n`);

        console.log('🗑️  Step 2/3: Deleting channels...');
        const channelsResult = await Channel.deleteMany({});
        console.log(`   ✅ Deleted ${channelsResult.deletedCount} channel(s)\n`);

        console.log('🗑️  Step 3/3: Deleting workspaces...');
        const workspacesResult = await Workspace.deleteMany({});
        console.log(`   ✅ Deleted ${workspacesResult.deletedCount} workspace(s)\n`);

        // Verify deletion
        const remainingWorkspaces = await Workspace.countDocuments({});
        const remainingChannels = await Channel.countDocuments({});
        const remainingMessages = await Message.countDocuments({});

        console.log('═══════════════════════════════════════════');
        console.log('  📊 FINAL STATE');
        console.log('═══════════════════════════════════════════\n');
        console.log(`Remaining Workspaces: ${remainingWorkspaces}`);
        console.log(`Remaining Channels: ${remainingChannels}`);
        console.log(`Remaining Messages: ${remainingMessages}\n`);

        if (remainingWorkspaces === 0 && remainingChannels === 0 && remainingMessages === 0) {
            console.log('✅ SUCCESS! Database completely wiped!\n');
        } else {
            console.log('⚠️  Some data remains. Check for errors.\n');
        }

        await mongoose.disconnect();
        console.log('═══════════════════════════════════════════');
        console.log('  ✅ Cleanup Complete!');
        console.log('═══════════════════════════════════════════\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

nukeDatabase();
