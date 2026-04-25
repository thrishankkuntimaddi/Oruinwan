#!/usr/bin/env node

const mongoose = require('mongoose');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config();

const Workspace = require('./models/Workspace');
const User = require('./models/User');
const { UserWorkspaceKey, WorkspaceKey } = require('./models/encryption');

function generateWorkspaceKey() {
    return crypto.randomBytes(32);
}

function generateIV() {
    return crypto.randomBytes(12);
}

function generateSalt() {
    return crypto.randomBytes(16);
}

function deriveKEK(password, salt) {
    return crypto.pbkdf2Sync(
        password,
        salt,
        100000, 
        32, 
        'sha256'
    );
}

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
                case '\u0004': 
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    resolve(password);
                    break;
                case '\u0003': 
                    process.exit();
                    break;
                case '\u007f': 
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

async function initWorkspaceKeys() {
    try {
        console.log('🔐 E2EE Workspace Key Initialization Script\n');

        
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix');
        console.log('✅ Connected to MongoDB\n');

        
        const workspaces = await Workspace.find().populate('members.user', 'username email');
        console.log(`📊 Found ${workspaces.length} workspaces\n`);

        if (workspaces.length === 0) {
            console.log('ℹ️  No workspaces found. Nothing to initialize.');
            rl.close();
            await mongoose.disconnect();
            return;
        }

        
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

        
        for (const workspace of workspacesNeedingKeys) {
            console.log('━'.repeat(60));
            console.log(`📁 Workspace: ${workspace.name}`);
            console.log(`   Type: ${workspace.type}`);
            console.log(`   Members: ${workspace.members.length}`);

            
            const owner = workspace.members.find(m => m.role === 'owner');
            if (!owner) {
                console.log('❌ No owner found, skipping...\n');
                continue;
            }

            const ownerUser = owner.user;
            console.log(`   Owner: ${ownerUser.username} (${ownerUser.email})\n`);

            
            const shouldInit = await question(`Initialize keys for "${workspace.name}"? (y/n): `);
            if (shouldInit.toLowerCase() !== 'y') {
                console.log('⏭️  Skipped\n');
                continue;
            }

            
            const password = await questionHidden(`Enter password for ${ownerUser.username}: `);

            if (!password) {
                console.log('❌ Password required, skipping...\n');
                continue;
            }

            try {
                
                console.log('🔑 Generating workspace key...');
                const workspaceKey = generateWorkspaceKey();

                
                const enrollments = [];

                for (const member of workspace.members) {
                    const userId = member.user._id || member.user;
                    const salt = generateSalt();

                    
                    
                    const kek = deriveKEK(password, salt);

                    
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

initWorkspaceKeys();
