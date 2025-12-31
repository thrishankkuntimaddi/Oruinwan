// server/scripts/nukeDbExceptAdmin.js
const mongoose = require('mongoose');
require('dotenv').config();

const nukeDbExceptAdmin = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        // Handle potential connection string differences
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get all collections
        const collections = await mongoose.connection.db.collections();

        console.log(`\n⚠️  WARNING: About to NUKE database (preserving Chttrix Admins)...\n`);

        for (const collection of collections) {
            const modelName = collection.collectionName;

            if (modelName === 'users') {
                // For users, only delete those who match the criteria
                // We want to DELETE users who DO NOT have the 'chttrix_admin' role

                const query = {
                    roles: { $nin: ['chttrix_admin'] }
                };

                const count = await collection.countDocuments(query);
                if (count > 0) {
                    await collection.deleteMany(query);
                    console.log(`✅ Deleted ${count} non-admin users from 'users' collection`);
                } else {
                    console.log(`ℹ️  No non-admin users found to delete`);
                }

                // Also verify how many admins remain
                const adminCount = await collection.countDocuments({ roles: 'chttrix_admin' });
                console.log(`🛡️  Preserved ${adminCount} Chttrix Admin(s)`);

            } else {
                // For all other collections, delete EVERYTHING
                // Specifically skip system collections if any (though usually hidden)
                if (modelName.startsWith('system.')) continue;

                const count = await collection.countDocuments();
                if (count > 0) {
                    await collection.deleteMany({});
                    console.log(`✅ Deleted ${count} documents from '${modelName}'`);
                }
            }
        }

        console.log('\n✨ Database nuke complete (Admins preserved)!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error nuking database:', error);
        process.exit(1);
    }
};

nukeDbExceptAdmin();
