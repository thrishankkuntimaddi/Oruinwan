// server/scripts/cleanupKeepAdmin.js
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database Cleanup Script - Keep Only Chttrix Admin
 * 
 * This script deletes ALL data except the chttrix_admin user:
 * - Deletes all collections (channels, workspaces, messages, companies, etc.)
 * - Deletes all users EXCEPT those with 'chttrix_admin' role
 */

const cleanupDatabase = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Step 1: Delete users WITHOUT chttrix_admin role
        console.log('👤 Cleaning users...\n');
        const usersCollection = db.collection('users');

        const totalUsers = await usersCollection.countDocuments();
        const adminUsers = await usersCollection.countDocuments({ roles: 'chttrix_admin' });

        console.log(`📊 Total users: ${totalUsers}`);
        console.log(`👑 Admin users: ${adminUsers}`);
        console.log(`🗑️  Users to delete: ${totalUsers - adminUsers}\n`);

        const deleteResult = await usersCollection.deleteMany({
            roles: { $ne: 'chttrix_admin' }
        });

        console.log(`✅ Deleted ${deleteResult.deletedCount} non-admin users\n`);

        // Step 2: Clean admin user references
        console.log('🧹 Cleaning admin user references...\n');

        await usersCollection.updateMany(
            { roles: 'chttrix_admin' },
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

        console.log('✅ Admin user references cleaned\n');

        // Step 3: Delete all other collections
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
            'auditlogs',
            'historylogs',
            'permissions',
            'updates',
            'supporttickets',
            'chatsessions'
        ];

        console.log('🗑️  Deleting collections...\n');

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
                console.log(`⏭️  Skipped ${collectionName} (does not exist)`);
            }
        }

        console.log(`\n📊 Total deleted: ${totalDeleted} documents\n`);

        // Step 4: Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Database Cleanup Complete!\n');
        console.log(`📊 Summary:`);
        console.log(`   - Non-admin users deleted: ${deleteResult.deletedCount}`);
        console.log(`   - Admin users preserved: ${adminUsers}`);
        console.log(`   - Collections cleaned: ${collectionsToDelete.length}`);
        console.log(`   - Documents removed: ${totalDeleted}`);
        console.log('\n✅ Only chttrix_admin user(s) remain in the database.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error cleaning database:', error);
        process.exit(1);
    }
};

cleanupDatabase();
