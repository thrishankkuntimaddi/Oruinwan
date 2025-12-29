// server/scripts/cleanupKeepUsers.js
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database Cleanup Script - Keep Only User Login Data
 * 
 * This script deletes ALL data except user authentication/profile data:
 * - Deletes all collections (channels, workspaces, messages, tasks, notes, etc.)
 * - Keeps the users collection
 * - Cleans user references to deleted entities
 */

const cleanupDatabase = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Collections to delete completely
        const collectionsToDelete = [
            'channels',
            'workspaces',
            'messages',
            'tasks',
            'notes',
            'companies',
            'departments',
            'invites',
            'dmsessions',
            'favorites',
            'auditlegs',
            'historylogs',
            'permissions',
            'updates'
        ];

        console.log('⚠️  WARNING: This will delete the following collections:\n');
        collectionsToDelete.forEach(col => console.log(`   - ${col}`));
        console.log('\n📊 Starting cleanup process...\n');

        // Step 1: Delete all specified collections
        let totalDeleted = 0;
        for (const collectionName of collectionsToDelete) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();

                if (count > 0) {
                    await collection.deleteMany({});
                    console.log(`✅ Deleted ${count} documents from ${collectionName}`);
                    totalDeleted += count;
                } else {
                    console.log(`⏭️  Skipped ${collectionName} (empty)`);
                }
            } catch (error) {
                // Collection might not exist
                console.log(`⏭️  Skipped ${collectionName} (does not exist)`);
            }
        }

        console.log(`\n📊 Total deleted: ${totalDeleted} documents\n`);

        // Step 2: Clean user references to deleted entities
        console.log('🧹 Cleaning user references...\n');

        const usersCollection = db.collection('users');
        const userCount = await usersCollection.countDocuments();
        console.log(`📊 Found ${userCount} user(s) to clean\n`);

        const updateResult = await usersCollection.updateMany(
            {},
            {
                $set: {
                    workspaces: [],
                    personalWorkspace: null,
                    companyId: null,
                    departments: [],
                    favorites: [],
                    mutedChats: [],
                    companyRole: 'member',
                    userType: 'personal',
                    rolesPerCompany: {}
                }
            }
        );

        console.log(`✅ Updated ${updateResult.modifiedCount} user record(s)\n`);

        // Step 3: Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Database Cleanup Complete!\n');
        console.log(`📊 Summary:`);
        console.log(`   - Collections deleted: ${collectionsToDelete.length}`);
        console.log(`   - Documents removed: ${totalDeleted}`);
        console.log(`   - Users cleaned: ${updateResult.modifiedCount}`);
        console.log(`   - Users preserved: ${userCount}`);
        console.log('\n✅ User login data has been preserved.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error cleaning database:', error);
        process.exit(1);
    }
};

cleanupDatabase();
