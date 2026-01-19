// Script to clear all messages from the database
const mongoose = require('mongoose');
require('dotenv').config();

const Message = require('./models/Message');

async function clearMessages() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('📦 Connected to MongoDB');

        // Delete all messages
        const result = await Message.deleteMany({});
        console.log(`🗑️  Deleted ${result.deletedCount} messages`);

        // Disconnect
        await mongoose.disconnect();
        console.log('✅ Done! Database disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

clearMessages();
