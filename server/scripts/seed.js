#!/usr/bin/env node
'use strict';

/**
 * Demo data: one company, its default workspace and three users (owner, admin,
 * employee). Identity lives in PostgreSQL, so this needs DATABASE_URL (and the
 * migrations, which it applies). It CLEARS the identity tables first.
 *
 *   node scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, closePostgres } = require('../src/shared/postgres');
const { runMigrations } = require('../src/shared/migrations');
const identity = require('../src/identity');

async function seedData() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await runMigrations();
    console.log('✅ PostgreSQL ready');

    console.log('🗑️  Clearing existing identity data...');
    await query('TRUNCATE companies, users, workspaces, invites CASCADE');
    console.log('✅ Data cleared');

    console.log('🏢 Creating company...');
    const company = await identity.companies.create({
        name: 'Oruinwan Technologies',
        domain: 'oruinwan.com',
        isActive: true,
        domainVerified: true,
        autoJoinByDomain: true,
        allowedEmails: ['admin@oruinwan.com', 'employee@oruinwan.com'],
        settings: { allowSelfRegistration: true, requireEmailVerification: false, defaultUserRole: 'member' },
    });
    console.log(`✅ Company created: ${company.name} (${company._id})`);

    const makeUser = async (username, email, password, companyRole, jobTitle) => identity.users.create({
        username, email, passwordHash: await bcrypt.hash(password, 12), verified: true, userType: 'company',
        companyId: company._id, companyRole, jobTitle, profile: { name: username },
    });

    console.log('👤 Creating users...');
    const adminUser = await makeUser('Admin User', 'admin@oruinwan.com', 'admin123', 'owner', 'System Administrator');
    await identity.companies.addAdmin(company._id, adminUser._id, 'owner');
    const employeeUser = await makeUser('John Employee', 'employee@oruinwan.com', 'employee123', 'member', 'Software Engineer');
    const admin2User = await makeUser('Jane Admin', 'jane@oruinwan.com', 'admin456', 'admin', 'Team Lead');
    await identity.companies.addAdmin(company._id, admin2User._id, 'admin');

    console.log('🏗️  Creating default workspace...');
    const workspace = await identity.workspaces.create({
        name: 'General',
        description: 'Default workspace for all team members',
        company: company._id,
        type: 'company',
        icon: '🏢',
        createdBy: adminUser._id,
        members: [
            { user: adminUser._id, role: 'owner' },
            { user: admin2User._id, role: 'admin' },
            { user: employeeUser._id, role: 'member' },
        ],
    });
    await identity.companies.update(company._id, { defaultWorkspace: workspace._id });
    console.log(`✅ Workspace created: ${workspace.name} (${workspace._id}) with ${workspace.members.length} members`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE SEEDED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n🔐 Login Credentials:');
    console.log('   👑 OWNER     admin@oruinwan.com / admin123');
    console.log('   🛡️  ADMIN     jane@oruinwan.com / admin456');
    console.log('   👤 EMPLOYEE  employee@oruinwan.com / employee123');
    console.log('='.repeat(60) + '\n');
}

seedData()
    .then(() => closePostgres())
    .then(() => process.exit(0))
    .catch((err) => { console.error('❌ Seed Error:', err); process.exit(1); });
