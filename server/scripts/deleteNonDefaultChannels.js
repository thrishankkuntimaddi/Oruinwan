#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

const Channel = require("../src/features/channels/channel.model.js");
const Message = require("../src/features/messages/message.model.js");
const ConversationKey = require('../models/ConversationKey');

async function deleteNonDefaultChannels() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to database\n');

        
        const nonDefaultChannels = await Channel.find({ isDefault: false }).lean();
        console.log(`📊 Found ${nonDefaultChannels.length} non-default channels to delete\n`);

        if (nonDefaultChannels.length === 0) {
            console.log('✅ No non-default channels found. Nothing to delete.');
            await mongoose.disconnect();
            return;
        }

        
        console.log('📋 Channels to be deleted:');
        nonDefaultChannels.forEach((ch, idx) => {
            console.log(`   ${idx + 1}. #${ch.name} (${ch.isPrivate ? 'Private' : 'Public'}, ${ch.members?.length || 0} members)`);
        });
        console.log('');

        
        const channelIds = nonDefaultChannels.map(ch => ch._id);

        
        console.log('⏳ Deleting in 2 seconds... Press Ctrl+C to cancel\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('🗑️  Starting deletion...\n');

        
        const messagesDeleted = await Message.deleteMany({ channel: { $in: channelIds } });
        console.log(`✅ Messages deleted: ${messagesDeleted.deletedCount}`);

        
        const keysDeleted = await ConversationKey.deleteMany({
            conversationId: { $in: channelIds.map(id => id.toString()) },
            conversationType: 'channel'
        });
        console.log(`✅ Conversation keys deleted: ${keysDeleted.deletedCount}`);

        
        const channelsDeleted = await Channel.deleteMany({ isDefault: false });
        console.log(`✅ Channels deleted: ${channelsDeleted.deletedCount}`);

        console.log('\n' + '='.repeat(70));
        console.log('✅ NON-DEFAULT CHANNELS CLEANUP COMPLETE');
        console.log('='.repeat(70));
        console.log('\n✅ Default channels (#general, #announcements) preserved');
        console.log('✅ Users, workspaces, and other data untouched\n');

        await mongoose.disconnect();
        console.log('🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error deleting channels:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

deleteNonDefaultChannels();
