#!/usr/bin/env node
'use strict';

/**
 * Create (or promote) the Oruinwan platform admin account in PostgreSQL.
 *   node scripts/createOruinwanAdmin.js
 * ORUINWAN_ADMIN_EMAIL overrides the default email. ORUINWAN_ADMIN_PASS sets the password;
 * without it a random one is generated and printed once.
 */

require('dotenv').config({ path: '.env' });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { closePostgres } = require('../src/shared/postgres');
const { users } = require('../src/identity');

const ORUINWAN_ADMIN_EMAIL = process.env.ORUINWAN_ADMIN_EMAIL || 'platform-admin@oruinwan.com';
const ORUINWAN_ADMIN_PASSWORD = process.env.ORUINWAN_ADMIN_PASS || crypto.randomBytes(12).toString('base64url');
const ORUINWAN_ADMIN_USERNAME = 'Oruinwan Admin';

async function createOruinwanAdmin() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

    const existingAdmin = await users.findByEmail(ORUINWAN_ADMIN_EMAIL);
    if (existingAdmin) {
        console.log('⚠️  Oruinwan admin user already exists!');
        console.log('📧 Email:', existingAdmin.email);
        console.log('👤 Username:', existingAdmin.username);
        console.log('🔑 Roles:', existingAdmin.roles);
        if (!existingAdmin.roles.includes('oruinwan_admin')) {
            await users.update(existingAdmin._id, { roles: [...existingAdmin.roles, 'oruinwan_admin'] });
            console.log("✅ Added 'oruinwan_admin' role to existing user");
        }
        return;
    }

    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(ORUINWAN_ADMIN_PASSWORD, 12);

    console.log('👤 Creating Oruinwan admin user...');
    const adminUser = await users.create({
        username: ORUINWAN_ADMIN_USERNAME,
        email: ORUINWAN_ADMIN_EMAIL,
        passwordHash,
        userType: 'personal',
        verified: true,
        roles: ['user', 'oruinwan_admin'],
        accountStatus: 'active',
        profile: { name: ORUINWAN_ADMIN_USERNAME, about: 'Oruinwan Platform Administrator' },
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Oruinwan Admin User Created Successfully!');
    console.log('='.repeat(60));
    console.log('📧 Email:', ORUINWAN_ADMIN_EMAIL);
    console.log('🔑 Password:', ORUINWAN_ADMIN_PASSWORD);
    console.log('👤 Username:', ORUINWAN_ADMIN_USERNAME);
    console.log('🛡️  Roles:', adminUser.roles);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
}

createOruinwanAdmin()
    .then(() => closePostgres())
    .catch((err) => { console.error('❌ Error creating Oruinwan admin:', err); process.exit(1); });
