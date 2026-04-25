require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require("../src/features/channels/channel.model.js");

async function checkChannelData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        
        const channels = await Channel.find({ isDefault: true })
            .select('name workspace createdBy createdAt members systemEvents')
            .lean(); 

        console.log(`📊 Found ${channels.length} default channels\n`);

        for (const channel of channels) {
            console.log('='.repeat(70));
            console.log(`Channel: #${channel.name}`);
            console.log(`Created: ${channel.createdAt}`);
            console.log(`Creator ID: ${channel.createdBy}`);
            console.log(`Members: ${channel.members.length}`);
            console.log(`SystemEvents: ${JSON.stringify(channel.systemEvents, null, 2)}`);
            console.log('='.repeat(70) + '\n');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkChannelData();
