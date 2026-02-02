/**
 * Repair Script: Fix E2EE Key Distribution Invariant Violations
 * 
 * WHAT THIS DOES:
 * 1. Finds all users who are in channel.members but NOT in encryptedKeys  
 * 2. Calls repairConversationKeyForUser() for each
 * 3. Logs detailed results
 * 
 * WHEN TO RUN:
 * - After fixing the race condition (one-time cleanup)
 * - Manually if KEY_NOT_DISTRIBUTED errors appear
 * 
 * HOW TO RUN:
 * node scripts/repairKeyDistribution.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Channel = require("../src/features/channels/channel.model.js");
const ConversationKey = require('../models/ConversationKey');
const conversationKeysService = require('../src/modules/conversations/conversationKeys.service');

async function findViolations() {
    console.log('🔍 [REPAIR] Scanning for invariant violations...\n');

    const violations = [];

    // Get all channels
    const channels = await Channel.find({}).select('_id name members').lean();

    for (const channel of channels) {
        // Get conversation key for this channel
        const conversationKey = await ConversationKey.findOne({
            conversationId: channel._id.toString(),
            conversationType: 'channel'
        }).lean();

        if (!conversationKey) {
            console.log(`⚠️ Channel ${channel.name} (${channel._id}) has NO conversation key at all`);
            continue;
        }

        // Extract member user IDs
        const memberIds = channel.members.map(m => {
            const userId = m.user ? m.user.toString() : m.toString();
            return userId;
        });

        // Extract users who have encryption keys
        const usersWithKeys = new Set(
            conversationKey.encryptedKeys.map(ek => ek.userId.toString())
        );

        // Find members without keys (INVARIANT VIOLATION)
        for (const memberId of memberIds) {
            if (!usersWithKeys.has(memberId)) {
                violations.push({
                    channelId: channel._id.toString(),
                    channelName: channel.name,
                    userId: memberId,
                    hasWorkspaceKey: !!conversationKey.workspaceEncryptedKey
                });
            }
        }
    }

    return violations;
}

async function repairViolations(violations) {
    console.log(`\n🔧 [REPAIR] Found ${violations.length} violations to repair\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const results = {
        success: [],
        alreadyRepaired: [],
        cannotRepair: [],
        errors: []
    };

    for (const violation of violations) {
        const { channelId, channelName, userId, hasWorkspaceKey } = violation;

        console.log(`📝 Repairing:`);
        console.log(`   Channel: ${channelName} (${channelId})`);
        console.log(`   User: ${userId}`);
        console.log(`   Has workspace key: ${hasWorkspaceKey ? 'YES' : 'NO'}`);

        if (!hasWorkspaceKey) {
            console.log(`   ❌ SKIP: Legacy channel without workspace key (cannot repair)\n`);
            results.cannotRepair.push(violation);
            continue;
        }

        try {
            const repairResult = await conversationKeysService.repairConversationKeyForUser(
                channelId,
                userId
            );

            if (repairResult.result === 'REPAIR_SUCCESS') {
                console.log(`   ✅ REPAIRED: Key distributed successfully\n`);
                results.success.push({ ...violation, result: repairResult });
            } else if (repairResult.result === 'NO_REPAIR_NEEDED') {
                console.log(`   ℹ️ ALREADY FIXED: User already has key (race condition?)\n`);
                results.alreadyRepaired.push({ ...violation, result: repairResult });
            } else {
                console.log(`   ⚠️ CANNOT REPAIR: ${repairResult.reason}\n`);
                results.cannotRepair.push({ ...violation, result: repairResult });
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}\n`);
            results.errors.push({ ...violation, error: error.message });
        }
    }

    return results;
}

function printSummary(results) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [REPAIR] Summary Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`✅ Successfully repaired: ${results.success.length}`);
    console.log(`ℹ️  Already had keys: ${results.alreadyRepaired.length}`);
    console.log(`⚠️  Cannot repair: ${results.cannotRepair.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    if (results.cannotRepair.length > 0) {
        console.log('\n⚠️ Users who cannot be repaired:');
        results.cannotRepair.forEach(v => {
            console.log(`   Channel: ${v.channelName}, User: ${v.userId}`);
            console.log(`   Reason: ${v.result?.reason || 'Unknown'}`);
        });
    }

    if (results.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        results.errors.forEach(v => {
            console.log(`   Channel: ${v.channelName}, User: ${v.userId}`);
            console.log(`   Error: ${v.error}`);
        });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔧 E2EE Key Distribution Repair Script');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Find violations
        const violations = await findViolations();

        if (violations.length === 0) {
            console.log('✅ No invariant violations found! All users have encryption keys.');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            await mongoose.disconnect();
            return;
        }

        // Repair violations
        const results = await repairViolations(violations);

        // Print summary
        printSummary(results);

        // Disconnect
        await mongoose.disconnect();
        console.log('✅ Disconnected from database\n');

        // Exit code
        if (results.errors.length > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Fatal error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
