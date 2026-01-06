// server/scripts/resetDatabase.js
const mongoose = require('mongoose');
require('dotenv').config();

const resetDatabase = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const collections = await mongoose.connection.db.collections();

        console.log(`\n⚠️  WARNING: About to delete ${collections.length} collections:\n`);
        collections.forEach(col => console.log(`   - ${col.collectionName}`));

        console.log('\n🗑️  Deleting all data...\n');

        for (const collection of collections) {
            const count = await collection.countDocuments();
            await collection.deleteMany({});
            console.log(`✅ Deleted ${count} documents from ${collection.collectionName}`);
        }

        console.log('\n✨ Database reset complete!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    }
};

resetDatabase();
