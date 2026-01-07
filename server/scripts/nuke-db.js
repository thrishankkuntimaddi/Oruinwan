// Script to nuke database but keep admin data
require('dotenv').config();
const mongoose = require('mongoose');

async function nukeDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // Get all collection names
        const collections = await db.listCollections().toArray();
        console.log(`📋 Found ${collections.length} collections`);

        // Collections to completely drop
        const collectionsToNuke = [
            'companies',
            'workspaces',
            'channels',
            'messages',
            'tasks',
            'notes',
            'departments',
            'supporttickets',
            'platformsessions',
            'auditlogs',
            'tickets',
            'broadcasts',
            'billings'
        ];

        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;

            if (collectionsToNuke.includes(collectionName.toLowerCase())) {
                console.log(`🗑️  Dropping collection: ${collectionName}`);
                await db.dropCollection(collectionName);
            }
        }

        // Clean users BUT keep only chttrix_admins
        console.log('👥 Cleaning users collection (keeping admins)...');
        const usersCollection = db.collection('users');
        const result = await usersCollection.deleteMany({
            roles: { $nin: ['chttrix_admin'] }
        });
        console.log(`✅ Deleted ${result.deletedCount} non-admin users`);

        const adminCount = await usersCollection.countDocuments({ roles: 'chttrix_admin' });
        console.log(`✅ Preserved ${adminCount} admin users`);

        console.log('🎉 Database reset complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

nukeDatabase();
