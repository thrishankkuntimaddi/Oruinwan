// server/scripts/checkChannelData.js
/**
 * Debug Script: Check channel data to see what's actually in the database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');

async function checkChannelData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all default channels
        const channels = await Channel.find({ isDefault: true })
            .select('name workspace createdBy createdAt members systemEvents')
            .lean(); // Use lean() to get plain objects

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
