// Cleanup script to manage workspace invitations
require('dotenv').config();
const mongoose = require('mongoose');
const Invite = require('../models/Invite');
const Workspace = require('../models/Workspace');

// Configuration
const WORKSPACE_NAME = "Lily's Workspace"; // Change this to your workspace name
const ACTION = 'list'; // Options: 'delete', 'revoke', 'list'

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

async function cleanupInvitations() {
    try {
        // Find workspace by name
        const workspace = await Workspace.findOne({ name: WORKSPACE_NAME });
        if (!workspace) {
            console.error(`❌ Workspace "${WORKSPACE_NAME}" not found`);
            return;
        }

        console.log(`\n📋 Workspace: ${workspace.name}`);
        console.log(`   ID: ${workspace._id}\n`);

        // Find all invitations for this workspace
        const invitations = await Invite.find({ workspace: workspace._id })
            .populate('invitedBy', 'username email')
            .sort({ createdAt: -1 });

        console.log(`Found ${invitations.length} total invitations\n`);

        // Categorize invitations
        const pending = invitations.filter(inv => inv.status === 'pending');
        const accepted = invitations.filter(inv => inv.status === 'accepted');
        const revoked = invitations.filter(inv => inv.status === 'revoked');
        const expired = invitations.filter(inv => {
            return inv.status === 'pending' && inv.expiresAt < new Date();
        });

        console.log('📊 Invitation Breakdown:');
        console.log(`   Pending: ${pending.length}`);
        console.log(`   Accepted: ${accepted.length}`);
        console.log(`   Revoked: ${revoked.length}`);
        console.log(`   Expired: ${expired.length}\n`);

        // Find duplicates
        const emailCounts = {};
        pending.forEach(inv => {
            emailCounts[inv.email] = (emailCounts[inv.email] || 0) + 1;
        });
        const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1);

        if (duplicates.length > 0) {
            console.log('⚠️  Duplicate Emails Found:');
            duplicates.forEach(([email, count]) => {
                console.log(`   ${email}: ${count} invitations`);
            });
            console.log('');
        }

        if (ACTION === 'list') {
            // Just list the invitations
            console.log('\n📋 Pending Invitations:');
            pending.forEach((inv, index) => {
                const isDuplicate = emailCounts[inv.email] > 1;
                const duplicateMarker = isDuplicate ? ' ⚠️  DUPLICATE' : '';
                console.log(`   ${index + 1}. ${inv.email} (${inv.role}) - invited by ${inv.invitedBy?.username || 'System'}${duplicateMarker}`);
            });
            console.log('\n✅ List completed. No changes made.');
            return;
        }

        if (ACTION === 'revoke') {
            // Revoke all pending invitations
            console.log('🔄 Revoking all pending invitations...');

            let revokedCount = 0;
            for (const invite of pending) {
                invite.status = 'revoked';
                invite.revokedAt = new Date();
                invite.revokeReason = 'Bulk cleanup via script';
                await invite.save();
                revokedCount++;
                console.log(`   ✓ Revoked: ${invite.email}`);
            }

            console.log(`\n✅ Successfully revoked ${revokedCount} invitation(s)`);
            return;
        }

        if (ACTION === 'delete') {
            // Delete all pending invitations
            console.log('🗑️  Deleting all pending invitations...');

            const result = await Invite.deleteMany({
                workspace: workspace._id,
                status: 'pending'
            });

            console.log(`\n✅ Successfully deleted ${result.deletedCount} pending invitation(s)`);

            // Also offer to cleanup expired and revoked
            if (expired.length > 0 || revoked.length > 0) {
                console.log('\n💡 You also have:');
                if (expired.length > 0) console.log(`   ${expired.length} expired invitations`);
                if (revoked.length > 0) console.log(`   ${revoked.length} revoked invitations`);
                console.log('   Run with ACTION="delete-all" to remove these as well.');
            }
            return;
        }

        if (ACTION === 'delete-all') {
            // Delete all invitations except accepted ones
            console.log('🗑️  Deleting ALL non-accepted invitations...');

            const result = await Invite.deleteMany({
                workspace: workspace._id,
                status: { $ne: 'accepted' }
            });

            console.log(`\n✅ Successfully deleted ${result.deletedCount} invitation(s)`);
            console.log(`   Kept ${accepted.length} accepted invitation(s)`);
            return;
        }

        console.log('❌ Invalid ACTION. Use: "list", "revoke", "delete", or "delete-all"');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    }
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  🧹 Workspace Invitations Cleanup Script');
    console.log('═══════════════════════════════════════════════════════\n');

    await connectDB();
    await cleanupInvitations();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ Cleanup Complete!');
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(0);
}

main();
