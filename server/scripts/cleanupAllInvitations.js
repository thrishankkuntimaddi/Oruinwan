// Simple script to delete ALL pending invitations across all workspaces
require('dotenv').config();
const mongoose = require('mongoose');
const Invite = require('../models/Invite');

const ACTION = 'delete'; // Change to 'delete' to actually delete

async function main() {
    try {
        console.log('\n═══════════════════════════════════════════');
        console.log('  🧹 Global Invitations Cleanup');
        console.log('═══════════════════════════════════════════\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all pending invitations
        const pendingInvites = await Invite.find({ status: 'pending' }).lean();

        console.log(`📊 Found ${pendingInvites.length} pending invitations\n`);

        if (pendingInvites.length === 0) {
            console.log('✨ No pending invitations to clean up!');
            await mongoose.disconnect();
            return;
        }

        // Show first 20 invitations as preview
        console.log('📋 Sample of pending invitations:');
        pendingInvites.slice(0, 20).forEach((inv, idx) => {
            console.log(`  ${idx + 1}. ${inv.email} (${inv.role})`);
        });

        if (pendingInvites.length > 20) {
            console.log(`  ... and ${pendingInvites.length - 20} more\n`);
        } else {
            console.log('');
        }

        if (ACTION === 'list') {
            console.log('═══════════════════════════════════════════');
            console.log('  ℹ️  Preview Mode');
            console.log('═══════════════════════════════════════════');
            console.log(`\\nTo delete these ${pendingInvites.length} invitations:`);
            console.log(`1. Edit this script`);
            console.log(`2. Change line 6: const ACTION = 'delete'`);
            console.log(`3. Run again: node scripts/cleanupAllInvitations.js\\n`);
        }
        else if (ACTION === 'delete') {
            console.log('═══════════════════════════════════════════');
            console.log('  ⚠️  DELETE MODE');
            console.log('═══════════════════════════════════════════\n');

            console.log(`🗑️  Deleting ${pendingInvites.length} pending invitations...\\n`);

            const result = await Invite.deleteMany({ status: 'pending' });

            console.log(`✅ Successfully deleted ${result.deletedCount} invitation(s)!\\n`);
        }
        else {
            console.log(`❌ Invalid ACTION: "${ACTION}"`);
            console.log(`   Use 'list' or 'delete'\\n`);
        }

        await mongoose.disconnect();
        console.log('═══════════════════════════════════════════');
        console.log('  ✅ Complete!');
        console.log('═══════════════════════════════════════════\\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

main();
