#!/usr/bin/env node
/**
 * E2EE Workspace Key Initialization Script
 * 
 * This script initializes E2EE workspace keys for existing workspaces
 * that don't have encryption keys set up yet.
 * 
 * IMPORTANT: This is a ONE-TIME setup script for existing workspaces.
 * New workspaces should have keys created automatically on the client-side.
 * 
 * Usage:
 *   node initWorkspaceKeys.js
 * 
 * The script will:
 * 1. Find all workspaces without encryption keys
 * 2. For each workspace, prompt for the owner's password
 * 3. Generate a workspace key and encrypt it with the owner's password
 * 4. Create UserWorkspaceKey entries for all workspace members
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config();

// Import models
const Workspace = require('./models/Workspace');
const User = require('./models/User');
const { UserWorkspaceKey, WorkspaceKey } = require('./models/encryption');

// ==================== CRYPTO UTILITIES ====================

/**
 * Generate a random 256-bit workspace key
 */
function generateWorkspaceKey() {
    return crypto.randomBytes(32);
}

/**
 * Generate random IV (12 bytes for AES-GCM)
 */
function generateIV() {
    return crypto.randomBytes(12);
}

/**
 * Generate random salt for PBKDF2
 */
function generateSalt() {
    return crypto.randomBytes(16);
}

/**
 * Derive KEK (Key Encryption Key) from password using PBKDF2
 */
function deriveKEK(password, salt) {
    return crypto.pbkdf2Sync(
        password,
        salt,
        100000, // iterations
        32, // key length
        'sha256'
    );
}

/**
 * Encrypt workspace key with user's KEK
 */
function encryptWorkspaceKey(workspaceKey, kek) {
    const iv = generateIV();
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);

    let encrypted = cipher.update(workspaceKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, authTag]);

    return {
        encryptedKey: ciphertext.toString('base64'),
        iv: iv.toString('base64')
    };
}

// ==================== USER INPUT ====================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function questionHidden(query) {
    return new Promise(resolve => {
        const stdin = process.stdin;
        stdin.resume();
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');

        let password = '';
        process.stdout.write(query);

        const onData = (char) => {
            char = char.toString('utf8');

            switch (char) {
                case '\n':
                case '\r':
                case '\u0004': // Ctrl+D
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    resolve(password);
                    break;
                case '\u0003': // Ctrl+C
                    process.exit();
                    break;
                case '\u007f': // Backspace
                    password = password.slice(0, -1);
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    process.stdout.write(query + '*'.repeat(password.length));
                    break;
                default:
                    password += char;
                    process.stdout.write('*');
                    break;
            }
        };

        stdin.on('data', onData);
    });
}

// ==================== MAIN SCRIPT ====================

async function initWorkspaceKeys() {
    try {
        console.log('🔐 E2EE Workspace Key Initialization Script\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix');
        console.log('✅ Connected to MongoDB\n');

        // Find all workspaces
        const workspaces = await Workspace.find().populate('members.user', 'username email');
        console.log(`📊 Found ${workspaces.length} workspaces\n`);

        if (workspaces.length === 0) {
            console.log('ℹ️  No workspaces found. Nothing to initialize.');
            rl.close();
            await mongoose.disconnect();
            return;
        }

        // Check which workspaces already have keys
        const workspaceIds = workspaces.map(w => w._id);
        const existingKeys = await UserWorkspaceKey.find({
            workspaceId: { $in: workspaceIds }
        }).distinct('workspaceId');

        const workspacesNeedingKeys = workspaces.filter(w =>
            !existingKeys.some(id => id.toString() === w._id.toString())
        );

        console.log(`✅ ${existingKeys.length} workspaces already have keys`);
        console.log(`⚠️  ${workspacesNeedingKeys.length} workspaces need initialization\n`);

        if (workspacesNeedingKeys.length === 0) {
            console.log('✨ All workspaces already have encryption keys!');
            rl.close();
            await mongoose.disconnect();
            return;
        }

        // Process each workspace
        for (const workspace of workspacesNeedingKeys) {
            console.log('━'.repeat(60));
            console.log(`📁 Workspace: ${workspace.name}`);
            console.log(`   Type: ${workspace.type}`);
            console.log(`   Members: ${workspace.members.length}`);

            // Find workspace owner
            const owner = workspace.members.find(m => m.role === 'owner');
            if (!owner) {
                console.log('❌ No owner found, skipping...\n');
                continue;
            }

            const ownerUser = owner.user;
            console.log(`   Owner: ${ownerUser.username} (${ownerUser.email})\n`);

            // Ask if user wants to initialize this workspace
            const shouldInit = await question(`Initialize keys for "${workspace.name}"? (y/n): `);
            if (shouldInit.toLowerCase() !== 'y') {
                console.log('⏭️  Skipped\n');
                continue;
            }

            // Get owner's password
            const password = await questionHidden(`Enter password for ${ownerUser.username}: `);

            if (!password) {
                console.log('❌ Password required, skipping...\n');
                continue;
            }

            try {
                // Generate workspace key
                console.log('🔑 Generating workspace key...');
                const workspaceKey = generateWorkspaceKey();

                // Initialize keys for all members
                const enrollments = [];

                for (const member of workspace.members) {
                    const userId = member.user._id || member.user;
                    const salt = generateSalt();

                    // Derive KEK from password (same password for all members in this script)
                    // NOTE: In production, each user should have their own password
                    const kek = deriveKEK(password, salt);

                    // Encrypt workspace key with user's KEK
                    const { encryptedKey, iv } = encryptWorkspaceKey(workspaceKey, kek);

                    enrollments.push({
                        userId,
                        workspaceId: workspace._id,
                        encryptedKey,
                        keyIv: iv,
                        pbkdf2Salt: salt.toString('base64'),
                        pbkdf2Iterations: 100000
                    });
                }

                // Save all enrollments
                console.log(`💾 Enrolling ${enrollments.length} members...`);
                await UserWorkspaceKey.insertMany(enrollments);

                console.log(`✅ Successfully initialized keys for "${workspace.name}"`);
                console.log(`   ${enrollments.length} members enrolled\n`);

            } catch (err) {
                console.error(`❌ Failed to initialize "${workspace.name}":`, err.message);
                console.error('   Continuing to next workspace...\n');
            }
        }

        console.log('━'.repeat(60));
        console.log('✨ Workspace key initialization complete!');
        console.log('\n📝 Next steps:');
        console.log('   1. Users should log out and log back in');
        console.log('   2. Keys will be decrypted and loaded into sessionStorage');
        console.log('   3. Users can now send encrypted messages\n');

        rl.close();
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        rl.close();
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
initWorkspaceKeys();
