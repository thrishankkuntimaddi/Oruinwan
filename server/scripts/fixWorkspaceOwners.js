// Fix existing workspaces to have proper createdBy references
require('dotenv').config();
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

async function fixWorkspaceOwners() {
    try {
        console.log('\n═══════════════════════════════════════════');
        console.log('  🔧 Fix Workspace createdBy References');
        console.log('═══════════════════════════════════════════\n');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all workspaces
        const workspaces = await Workspace.find({});
        console.log(`📋 Found ${workspaces.length} workspace(s)\n`);

        let fixedCount = 0;
        let alreadyOkCount = 0;

        for (const workspace of workspaces) {
            console.log(`\n🔍 Checking workspace: ${workspace.name}`);
            console.log(`   Current createdBy: ${workspace.createdBy || 'NULL'}`);

            // If createdBy is missing, find the owner from members
            if (!workspace.createdBy) {
                const ownerMember = workspace.members.find(m => m.role === 'owner');

                if (ownerMember) {
                    workspace.createdBy = ownerMember.user;
                    await workspace.save();

                    const user = await User.findById(ownerMember.user);
                    console.log(`   ✅ Fixed! Set createdBy to: ${user?.username || 'Unknown'} (${ownerMember.user})`);
                    fixedCount++;
                } else {
                    console.log(`   ⚠️  No owner found in members!`);
                }
            } else {
                const user = await User.findById(workspace.createdBy);
                console.log(`   ✅ Already has createdBy: ${user?.username || 'Unknown'}`);
                alreadyOkCount++;
            }
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('  📊 SUMMARY');
        console.log('═══════════════════════════════════════════\n');
        console.log(`Total workspaces: ${workspaces.length}`);
        console.log(`✅ Fixed: ${fixedCount}`);
        console.log(`✓  Already OK: ${alreadyOkCount}`);
        console.log('');

        await mongoose.disconnect();
        console.log('✅ Complete!\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

fixWorkspaceOwners();
