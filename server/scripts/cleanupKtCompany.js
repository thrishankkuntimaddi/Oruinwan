'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const KEEP_EMAIL     = 'thrishank@kt.com';   
const COMPANY_DOMAIN = 'kt.com';             

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

    
    const wsResult = await db.collection('workspaces').updateMany(
        { company: companyId, 'members.user': { $in: idsToDelete } },
        { $pull: { members: { user: { $in: idsToDelete } } } }
    );
    console.log(`🏗️   Cleaned workspace members: ${wsResult.modifiedCount} docs`);

    
    const deleteResult = await db.collection('users').deleteMany({
        _id: { $in: idsToDelete }
    });
    console.log(`\n✅  Deleted ${deleteResult.deletedCount} user(s) from the database.`);

    
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
