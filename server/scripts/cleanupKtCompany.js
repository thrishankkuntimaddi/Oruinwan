/**
 * cleanupKtCompany.js
 *
 * One-shot script: Find the KT company and hard-delete ALL users
 * in that company EXCEPT thrishank@kt.com (the owner).
 *
 * Also cleans up:
 *   - Department.members[] / Department.managers[]
 *   - Workspace.members[]
 *
 * Usage:
 *   node scripts/cleanupKtCompany.js
 *
 * Run from the /server directory with the .env loaded (dotenv).
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const KEEP_EMAIL     = 'thrishank@kt.com';   // the one account to preserve
const COMPANY_DOMAIN = 'kt.com';             // used to identify the company

async function run() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌  No MONGO_URI found in environment. Aborting.');
        process.exit(1);
    }

    console.log('🔌  Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅  Connected.\n');

    const db = mongoose.connection.db;

    // ── 1. Find the KT company ────────────────────────────────────────────────
    const company = await db.collection('companies').findOne({
        $or: [{ domain: COMPANY_DOMAIN }, { name: 'KT' }]
    });

    if (!company) {
        console.error('❌  Could not find KT company — aborting.');
        await mongoose.connection.close();
        process.exit(1);
    }

    const companyId = company._id;
    console.log(`🏢  Found company: "${company.name}" (${companyId})`);

    // ── 2. Find all users in this company EXCEPT the keeper ──────────────────
    const usersToDelete = await db.collection('users').find({
        companyId: companyId,
        $or: [
            { email:        { $ne: KEEP_EMAIL } },
            { companyEmail: { $ne: KEEP_EMAIL } },
        ],
        email: { $ne: KEEP_EMAIL },
        companyEmail: { $ne: KEEP_EMAIL },
    }).toArray();

    if (usersToDelete.length === 0) {
        console.log('✅  No users to delete — DB is already clean!');
        await mongoose.connection.close();
        return;
    }

    const idsToDelete = usersToDelete.map(u => u._id);

    console.log(`\n🗑️   Users to DELETE (${idsToDelete.length}):`);
    usersToDelete.forEach(u => {
        console.log(`     • ${u.username} | ${u.email || u.companyEmail} | role: ${u.companyRole}`);
    });

    // ── 3. Clean up Department references ────────────────────────────────────
    const deptMembersResult = await db.collection('departments').updateMany(
        { company: companyId, members: { $in: idsToDelete } },
        { $pull: { members: { $in: idsToDelete } } }
    );
    const deptManagersResult = await db.collection('departments').updateMany(
        { company: companyId, managers: { $in: idsToDelete } },
        { $pull: { managers: { $in: idsToDelete } } }
    );
    console.log(`\n🏗️   Cleaned dept members: ${deptMembersResult.modifiedCount} docs`);
    console.log(`🏗️   Cleaned dept managers: ${deptManagersResult.modifiedCount} docs`);

    // ── 4. Clean up Workspace references ─────────────────────────────────────
    const wsResult = await db.collection('workspaces').updateMany(
        { company: companyId, 'members.user': { $in: idsToDelete } },
        { $pull: { members: { user: { $in: idsToDelete } } } }
    );
    console.log(`🏗️   Cleaned workspace members: ${wsResult.modifiedCount} docs`);

    // ── 5. Hard delete the users ──────────────────────────────────────────────
    const deleteResult = await db.collection('users').deleteMany({
        _id: { $in: idsToDelete }
    });
    console.log(`\n✅  Deleted ${deleteResult.deletedCount} user(s) from the database.`);

    // ── 6. Verify keeper is intact ────────────────────────────────────────────
    const keeper = await db.collection('users').findOne({
        companyId,
        email: KEEP_EMAIL
    });
    if (keeper) {
        console.log(`\n🔒  Verified: "${keeper.username}" (${keeper.email}) is still present as ${keeper.companyRole}.`);
    } else {
        console.warn(`\n⚠️   WARNING: could not verify ${KEEP_EMAIL} — check manually!`);
    }

    await mongoose.connection.close();
    console.log('\n🎉  Done! DB is clean.\n');
}

run().catch(err => {
    console.error('❌  Script failed:', err);
    mongoose.connection.close();
    process.exit(1);
});
