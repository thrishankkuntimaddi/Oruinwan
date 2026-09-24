const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const UserCryptoState = require('../models/UserCryptoState');
const kekManager = require('../services/kekManager.service');
const securityAudit = require('../services/securityAudit.service');
const crypto = require('crypto');

const BATCH_SIZE = parseInt(process.env.KEK_ROTATION_BATCH_SIZE || '10');
const DELAY_MS = parseInt(process.env.KEK_ROTATION_DELAY_MS || '100');

async function rotateUserKEK(cryptoState, fromVersion, toVersion) {
    try {
        const userId = cryptoState.userId;

        
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

        
        const newKEK = kekManager.getKEKForUnwrap(toVersion);
        const newIv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', newKEK, newIv);

        const newEncrypted = Buffer.concat([
            cipher.update(umekBytes),
            cipher.final()
        ]);

        const newAuthTag = cipher.getAuthTag();
        const newEnvelope = Buffer.concat([newIv, newAuthTag, newEncrypted]).toString('base64');

        
        cryptoState.umekEnvelope = newEnvelope;
        cryptoState.kekVersion = toVersion;
        cryptoState.updatedAt = new Date();

        await cryptoState.save();

        logger.info(`✅ Rotated KEK for user ${userId} (v${fromVersion} → v${toVersion})`);

        return true;
    } catch (error) {
        logger.error(`❌ Failed to rotate KEK for user ${cryptoState.userId}:`, error.message);
        return false;
    }
}

async function rotateServerKEK(options = {}) {
    const {
        fromVersion = 1,
        toVersion = 2,
        batchSize = BATCH_SIZE,
        delayMs = DELAY_MS,
        dryRun = false
    } = options;

    logger.info('\n🔄 Server KEK Rotation Started');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`From Version: ${fromVersion}`);
    logger.info(`To Version: ${toVersion}`);
    logger.info(`Batch Size: ${batchSize}`);
    logger.info(`Delay: ${delayMs}ms`);
    logger.info(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    
    if (!kekManager.kekVersionExists(fromVersion)) {
        throw new Error(`Old KEK version ${fromVersion} not found`);
    }

    if (!kekManager.kekVersionExists(toVersion)) {
        throw new Error(`New KEK version ${toVersion} not found`);
    }

    
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
        logger.warn('⚠️ Failed to log audit event (non-critical)');
    }

    
    const query = {
        umekProtectionType: 'SERVER_KEK',
        $or: [
            { kekVersion: fromVersion },
            { kekVersion: null }  
        ]
    };

    const totalUsers = await UserCryptoState.countDocuments(query);
    logger.info(`📊 Found ${totalUsers} users to rotate\n`);

    if (totalUsers === 0) {
        logger.info('✅ No users need rotation');
        return { success: true, rotated: 0, failed: 0 };
    }

    if (dryRun) {
        logger.info('🔍 DRY RUN - No changes will be made');
        return { success: true, rotated: 0, failed: 0 };
    }

    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (processed < totalUsers) {
        const users = await UserCryptoState.find(query)
            .limit(batchSize)
            .skip(processed);

        if (users.length === 0) break;

        logger.info(`Processing batch: ${processed + 1}-${processed + users.length} of ${totalUsers}`);

        for (const user of users) {
            const success = await rotateUserKEK(user, fromVersion, toVersion);
            if (success) {
                succeeded++;
            } else {
                failed++;
            }

            
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        processed += users.length;
    }

    
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
        logger.warn('⚠️ Failed to log audit event (non-critical)');
    }

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ Server KEK Rotation Complete');
    logger.info(`   Total: ${totalUsers}`);
    logger.info(`   Succeeded: ${succeeded}`);
    logger.info(`   Failed: ${failed}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { success: failed === 0, rotated: succeeded, failed };
}

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

    
    mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => {
        logger.info('✅ Connected to MongoDB');

        try {
            const result = await rotateServerKEK(options);
            process.exit(result.success ? 0 : 1);
        } catch (error) {
            logger.error('❌ Rotation failed:', error);

            
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
                
            }

            process.exit(1);
        }
    }).catch(error => {
        logger.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    });
}

module.exports = { rotateServerKEK };
