// server/src/scripts/rotateServerKEK.js

/**
 * Server KEK Rotation Script
 * 
 * PHASE 4D: Safe KEK rotation for OAuth users
 * 
 * Purpose:
 * - Re-wrap UMEKs with new KEK version
 * - Does NOT touch identity keys
 * - Does NOT touch password users
 * - Batch processing with rate limiting
 * 
 * Usage:
 * node server/src/scripts/rotateServerKEK.js --from-version=1 --to-version=2 [--batch-size=10] [--delay=100]
 */

const mongoose = require('mongoose');
const UserCryptoState = require('../models/UserCryptoState');
const kekManager = require('../services/kekManager.service');
const securityAudit = require('../services/securityAudit.service');
const crypto = require('crypto');

// Configuration
const BATCH_SIZE = parseInt(process.env.KEK_ROTATION_BATCH_SIZE || '10');
const DELAY_MS = parseInt(process.env.KEK_ROTATION_DELAY_MS || '100');

/**
 * Rotate KEK for a single user
 * @param {Object} cryptoState - User crypto state
 * @param {number} fromVersion - Old KEK version
 * @param {number} toVersion - New KEK version
 * @returns {Promise<boolean>}
 */
async function rotateUserKEK(cryptoState, fromVersion, toVersion) {
    try {
        const userId = cryptoState.userId;

        // Step 1: Unwrap UMEK with old KEK
        const oldKEK = kekManager.getKEKForUnwrap(fromVersion);
        const envelopeBuffer = Buffer.from(cryptoState.umekEnvelope, 'base64');
        const iv = envelopeBuffer.slice(0, 12);
        const authTag = envelopeBuffer.slice(12, 28);
        const encryptedUmek = envelopeBuffer.slice(28);

        const decipher = crypto.createDecipheriv('aes-256-gcm', oldKEK, iv);
        decipher.setAuthTag(authTag);

        const umekBytes = Buffer.concat([
            decipher.update(encryptedUmek),
            decipher.final()
        ]);

        // Step 2: Re-wrap UMEK with new KEK
        const newKEK = kekManager.getKEKForUnwrap(toVersion);
        const newIv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', newKEK, newIv);

        const newEncrypted = Buffer.concat([
            cipher.update(umekBytes),
            cipher.final()
        ]);

        const newAuthTag = cipher.getAuthTag();
        const newEnvelope = Buffer.concat([newIv, newAuthTag, newEncrypted]).toString('base64');

        // Step 3: Update crypto state
        cryptoState.umekEnvelope = newEnvelope;
        cryptoState.kekVersion = toVersion;
        cryptoState.updatedAt = new Date();

        await cryptoState.save();

        console.log(`✅ Rotated KEK for user ${userId} (v${fromVersion} → v${toVersion})`);

        return true;
    } catch (error) {
        console.error(`❌ Failed to rotate KEK for user ${cryptoState.userId}:`, error.message);
        return false;
    }
}

/**
 * Main rotation logic
 */
async function rotateServerKEK(options = {}) {
    const {
        fromVersion = 1,
        toVersion = 2,
        batchSize = BATCH_SIZE,
        delayMs = DELAY_MS,
        dryRun = false
    } = options;

    console.log('\n🔄 Server KEK Rotation Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`From Version: ${fromVersion}`);
    console.log(`To Version: ${toVersion}`);
    console.log(`Batch Size: ${batchSize}`);
    console.log(`Delay: ${delayMs}ms`);
    console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Validate KEKs exist
    if (!kekManager.kekVersionExists(fromVersion)) {
        throw new Error(`Old KEK version ${fromVersion} not found`);
    }

    if (!kekManager.kekVersionExists(toVersion)) {
        throw new Error(`New KEK version ${toVersion} not found`);
    }

    // Log audit event: rotation started
    try {
        await securityAudit.logSecurityEvent({
            userId: 'SYSTEM',
            eventType: 'SERVER_KEK_ROTATION_STARTED',
            metadata: {
                fromVersion,
                toVersion,
                dryRun
            }
        });
    } catch (_auditError) {
        console.warn('⚠️ Failed to log audit event (non-critical)');
    }

    // Find all SERVER_KEK users with old version
    const query = {
        umekProtectionType: 'SERVER_KEK',
        $or: [
            { kekVersion: fromVersion },
            { kekVersion: null }  // Legacy users (default to v1)
        ]
    };

    const totalUsers = await UserCryptoState.countDocuments(query);
    console.log(`📊 Found ${totalUsers} users to rotate\n`);

    if (totalUsers === 0) {
        console.log('✅ No users need rotation');
        return { success: true, rotated: 0, failed: 0 };
    }

    if (dryRun) {
        console.log('🔍 DRY RUN - No changes will be made');
        return { success: true, rotated: 0, failed: 0 };
    }

    // Process in batches
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (processed < totalUsers) {
        const users = await UserCryptoState.find(query)
            .limit(batchSize)
            .skip(processed);

        if (users.length === 0) break;

        console.log(`Processing batch: ${processed + 1}-${processed + users.length} of ${totalUsers}`);

        for (const user of users) {
            const success = await rotateUserKEK(user, fromVersion, toVersion);
            if (success) {
                succeeded++;
            } else {
                failed++;
            }

            // Rate limiting
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        processed += users.length;
    }

    // Log audit event: rotation completed
    try {
        await securityAudit.logSecurityEvent({
            userId: 'SYSTEM',
            eventType: 'SERVER_KEK_ROTATION_COMPLETED',
            metadata: {
                fromVersion,
                toVersion,
                total: totalUsers,
                succeeded,
                failed
            }
        });
    } catch (_auditError) {
        console.warn('⚠️ Failed to log audit event (non-critical)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Server KEK Rotation Complete');
    console.log(`   Total: ${totalUsers}`);
    console.log(`   Succeeded: ${succeeded}`);
    console.log(`   Failed: ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { success: failed === 0, rotated: succeeded, failed };
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            if (key === 'from-version') options.fromVersion = parseInt(value);
            if (key === 'to-version') options.toVersion = parseInt(value);
            if (key === 'batch-size') options.batchSize = parseInt(value);
            if (key === 'delay') options.delayMs = parseInt(value);
            if (key === 'dry-run') options.dryRun = true;
        }
    });

    // Connect to MongoDB
    mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            const result = await rotateServerKEK(options);
            process.exit(result.success ? 0 : 1);
        } catch (error) {
            console.error('❌ Rotation failed:', error);

            // Log failure audit event
            try {
                await securityAudit.logSecurityEvent({
                    userId: 'SYSTEM',
                    eventType: 'SERVER_KEK_ROTATION_FAILED',
                    metadata: {
                        error: error.message,
                        ...options
                    }
                });
            } catch (_auditError) {
                // Silent fail
            }

            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    });
}

module.exports = { rotateServerKEK };
