/**
 * Migration Script: Add E2EE Support
 * 
 * Run this script to:
 * 1. Create encryption key tables
 * 2. Update message schema for encrypted content
 * 3. Set up indexes
 * 
 * Usage:
 *   node migrations/add-e2ee-support.js up   (run migration)
 *   node migrations/add-e2ee-support.js down (rollback)
 */

const mongoose = require('mongoose');
const { migrateUp, migrateDown } = require('../models/encryption');
const Message = require('../models/Message'); // Import Message model

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chttrix';

async function runMigration() {
    const command = process.argv[2];

    if (!command || !['up', 'down'].includes(command)) {
        console.error('Usage: node add-e2ee-support.js [up|down]');
        process.exit(1);
    }

    try {
        // Connect to database
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to database');

        // Run migration
        if (command === 'up') {
            console.log('\n📦 Running E2EE migration UP...\n');
            await migrateUp();
        } else {
            console.log('\n⚠️  Running E2EE migration DOWN (rollback)...\n');
            await migrateDown();
        }

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
        process.exit(0);
    }
}

// Run migration
runMigration();
