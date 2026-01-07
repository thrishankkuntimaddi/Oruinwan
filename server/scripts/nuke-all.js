const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const nukeAll = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);

        console.log('🧨 Dropping database...');
        await mongoose.connection.dropDatabase();
        console.log('✅ Database dropped successfully');

        await mongoose.disconnect();
        console.log('👋 Disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error nuking database:', error);
        process.exit(1);
    }
};

nukeAll();
