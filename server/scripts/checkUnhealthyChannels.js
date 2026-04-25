const mongoose = require('mongoose');
require('dotenv').config();

const Channel = require('../src/features/channels/channel.model');
const ConversationKey = require('../models/ConversationKey');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

async function checkUnhealthyChannels() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        
        const channels = await Channel.find({})
            .populate('workspace', 'name company')
            .populate('createdBy', 'username email userType')
            .lean();

        console.log(`\n📊 Found ${channels.length} total channels`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const unhealthyChannels = [];

        for (const channel of channels) {
            
            const hasKey = await ConversationKey.findOne({
                conversationId: channel._id,
                conversationType: 'channel'
            });

            if (!hasKey) {
                unhealthyChannels.push(channel);
            }
        }

        console.log(`\n🔴 Found ${unhealthyChannels.length} channels WITHOUT E2EE keys:\n`);

        for (const channel of unhealthyChannels) {
            const workspaceCompanyId = channel.workspace?.company;
            const accountType = workspaceCompanyId ? 'COMPANY' : 'PERSONAL';

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Channel: #${channel.name}`);
            console.log(`   ├─ ID: ${channel._id}`);
            console.log(`   ├─ Workspace: ${channel.workspace?.name || 'Unknown'}`);
            console.log(`   ├─ Account Type: ${accountType}`);
            console.log(`   ├─ Created By: ${channel.createdBy?.username || 'Unknown'}`);
            console.log(`   ├─ User Type: ${channel.createdBy?.userType || 'Unknown'}`);
            console.log(`   ├─ Member Count: ${channel.members?.length || 0}`);
            console.log(`   ├─ Default Channel: ${channel.isDefault ? 'Yes' : 'No'}`);
            console.log(`   └─ Created: ${channel.createdAt}`);
        }

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`\n📊 SUMMARY:`);
        console.log(`   Total Channels: ${channels.length}`);
        console.log(`   Healthy (has E2EE): ${channels.length - unhealthyChannels.length}`);
        console.log(`   Unhealthy (no E2EE): ${unhealthyChannels.length}`);
        console.log(`   Health Score: ${Math.round(((channels.length - unhealthyChannels.length) / channels.length) * 100)}%`);

        
        const companyChannels = unhealthyChannels.filter(ch => ch.workspace?.company);
        const personalChannels = unhealthyChannels.filter(ch => !ch.workspace?.company);

        console.log(`\n📈 Unhealthy Channel Breakdown:`);
        console.log(`   Company Accounts: ${companyChannels.length}`);
        console.log(`   Personal Accounts: ${personalChannels.length}`);

        await mongoose.disconnect();
        console.log('\n✅ Done\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkUnhealthyChannels();
