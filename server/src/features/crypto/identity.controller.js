// server/src/features/crypto/identity.controller.js

const crypto = require('crypto');
const UserCryptoState = require('../../models/UserCryptoState');

// PHASE 4D: KEK management is now handled by kekManager.service.js
// (No longer using legacy SERVER_CRYPTO_KEK constant)

/**
 * Initialize or update user's identity crypto state
 * POST /api/v2/crypto/identity/init
 */
exports.initIdentityCryptoState = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            identityPublicKey,
            encryptedIdentityPrivateKey,
            identityPrivateKeyIv,
            umekEnvelope,
            umekEnvelopeIv,
            umekSalt,
            umekProtectionType,
            algorithm,
            version,
            allowOverwrite // Explicit flag for key rotation/recovery
        } = req.body;

        // Validate required fields
        if (!identityPublicKey || !encryptedIdentityPrivateKey || !identityPrivateKeyIv || !umekEnvelope || !umekProtectionType) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Validate umekProtectionType
        if (!['PASSWORD', 'SERVER_KEK'].includes(umekProtectionType)) {
            return res.status(400).json({
                message: 'Invalid umekProtectionType'
            });
        }

        // Validate PASSWORD protection has salt
        if (umekProtectionType === 'PASSWORD' && !umekSalt) {
            return res.status(400).json({
                message: 'umekSalt required for PASSWORD protection'
            });
        }

        // Check if crypto state already exists
        let cryptoState = await UserCryptoState.findOne({ userId });

        if (cryptoState) {
            // ⚠️ ISSUE 2 FIX: Prevent accidental identity overwrite
            if (!allowOverwrite) {
                return res.status(409).json({
                    message: 'Identity crypto state already exists. Set allowOverwrite=true to rotate keys.',
                    currentVersion: cryptoState.version
                });
            }

            console.log(`⚠️ Overwriting crypto state for user ${userId} (explicit recovery/rotation)`);

            // Update existing state (key rotation scenario)
            cryptoState.identityPublicKey = identityPublicKey;
            cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
            cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
            cryptoState.umekEnvelope = umekEnvelope;
            cryptoState.umekEnvelopeIv = umekEnvelopeIv || null;
            cryptoState.umekSalt = umekSalt || null;
            cryptoState.umekProtectionType = umekProtectionType;
            cryptoState.algorithm = algorithm || 'X25519';
            cryptoState.version = (cryptoState.version || 1) + 1; // Increment version
            cryptoState.updatedAt = new Date();

            await cryptoState.save();

            console.log(`✅ Updated crypto state for user ${userId} (version ${cryptoState.version})`);
        } else {
            // Create new crypto state
            cryptoState = await UserCryptoState.create({
                userId,
                identityPublicKey,
                encryptedIdentityPrivateKey,
                identityPrivateKeyIv,
                umekEnvelope,
                umekEnvelopeIv: umekEnvelopeIv || null,
                umekSalt: umekSalt || null,
                umekProtectionType,
                algorithm: algorithm || 'X25519',
                version: version || 1
            });

            console.log(`✅ Created crypto state for user ${userId}`);
        }

        return res.json({
            message: 'Identity crypto state saved',
            version: cryptoState.version
        });

    } catch (err) {
        console.error('❌ [initIdentityCryptoState] Error:', err);
        return res.status(500).json({
            message: 'Failed to save identity crypto state'
        });
    }
};

/**
 * Get user's identity crypto state
 * GET /api/v2/crypto/identity
 */
exports.getIdentityCryptoState = async (req, res) => {
    try {
        const userId = req.user.sub;

        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No identity crypto state found'
            });
        }

        // PHASE 4A: Log identity recovery (best-effort, non-blocking)
        try {
            const securityAudit = require('../../services/securityAudit.service');
            securityAudit.logSecurityEvent({
                userId,
                eventType: 'IDENTITY_RECOVERED',
                req,
                metadata: {
                    protectionType: cryptoState.umekProtectionType,
                    version: cryptoState.version
                }
            });
        } catch (_auditError) {
            // Silent fail (non-critical)
        }

        // Return crypto state (client will decrypt locally)
        return res.json({
            identityPublicKey: cryptoState.identityPublicKey,
            encryptedIdentityPrivateKey: cryptoState.encryptedIdentityPrivateKey,
            identityPrivateKeyIv: cryptoState.identityPrivateKeyIv,
            umekEnvelope: cryptoState.umekEnvelope,
            umekEnvelopeIv: cryptoState.umekEnvelopeIv,
            umekSalt: cryptoState.umekSalt,
            umekProtectionType: cryptoState.umekProtectionType,
            algorithm: cryptoState.algorithm,
            version: cryptoState.version
        });

    } catch (err) {
        console.error('❌ [getIdentityCryptoState] Error:', err);
        return res.status(500).json({
            message: 'Failed to fetch identity crypto state'
        });
    }
};

/**
 * Wrap UMEK with server KEK (for OAuth skip-password users)
 * This is called internally, not exposed as API
 * 
 * PHASE 4D: Now uses active KEK version
 */
exports.wrapUmekWithServerKEK = (umekBytes) => {
    try {
        const kekManager = require('../../services/kekManager.service');
        const { version, key } = kekManager.getActiveKEK();

        console.log(`🔐 [PHASE 4D] Wrapping UMEK with KEK version ${version}`);

        // Use AES-256-GCM to wrap UMEK
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(
            'aes-256-gcm',
            key,
            iv
        );

        const encrypted = Buffer.concat([
            cipher.update(umekBytes),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        // Return envelope (iv + authTag + encrypted) and version
        const envelope = Buffer.concat([iv, authTag, encrypted]).toString('base64');

        return { envelope, kekVersion: version };
    } catch (err) {
        console.error('❌ [wrapUmekWithServerKEK] Error:', err);
        throw new Error('Failed to wrap UMEK');
    }
};

/**
 * Unwrap UMEK with server KEK and re-wrap with client ephemeral session key
 * POST /api/v2/crypto/identity/unwrap-umek
 * 
 * SECURITY: Server NEVER returns plaintext UMEK over network
 * Instead, re-wraps UMEK with client's ephemeral public key (ESK)
 */
exports.unwrapUmekWithServerKEK = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { umekEnvelope, clientEphemeralPublicKey } = req.body;

        if (!umekEnvelope || !clientEphemeralPublicKey) {
            return res.status(400).json({
                message: 'Missing umekEnvelope or clientEphemeralPublicKey'
            });
        }

        // Verify this user's UMEK is protected by SERVER_KEK
        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No crypto state found'
            });
        }

        // ⚠️ DOWNGRADE PROTECTION: Reject if user has migrated to PASSWORD
        if (cryptoState.umekProtectionType !== 'SERVER_KEK') {
            console.warn(`⚠️ Attempted SERVER_KEK unwrap for user ${userId} who has ${cryptoState.umekProtectionType} protection`);
            return res.status(403).json({
                message: 'This account uses password-based protection',
                code: 'WRONG_PROTECTION_TYPE'
            });
        }

        // PHASE 4D: Get KEK by version
        const kekManager = require('../../services/kekManager.service');
        const kekVersion = cryptoState.kekVersion || 1;  // Default to v1 for legacy

        let kekKey;
        try {
            kekKey = kekManager.getKEKForUnwrap(kekVersion);
            console.log(`🔓 [PHASE 4D] Unwrapping UMEK with KEK version ${kekVersion}`);
        } catch (error) {
            console.error(`❌ [PHASE 4D] KEK version ${kekVersion} not available:`, error);
            return res.status(500).json({
                message: 'Server encryption key not available',
                code: 'KEK_NOT_AVAILABLE'
            });
        }

        // Unwrap UMEK using versioned KEK
        const envelopeBuffer = Buffer.from(umekEnvelope, 'base64');
        const iv = envelopeBuffer.slice(0, 12);
        const authTag = envelopeBuffer.slice(12, 28);
        const encryptedUmek = envelopeBuffer.slice(28);

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            kekKey,
            iv
        );
        decipher.setAuthTag(authTag);

        const umekBytes = Buffer.concat([
            decipher.update(encryptedUmek),
            decipher.final()
        ]);

        // ⚠️ CRITICAL: Server NEVER sends plaintext UMEK over network
        // Instead, re-wrap UMEK using client's ephemeral public key (ESK)

        // Decode client's ephemeral public key
        const clientPubKeyBytes = Buffer.from(clientEphemeralPublicKey, 'base64');

        // Generate ephemeral server keypair for ECDH
        const { publicKey: serverEphemeralPublicKey, privateKey: serverEphemeralPrivateKey } =
            crypto.generateKeyPairSync('x25519');

        // Perform ECDH
        const sharedSecret = crypto.diffieHellman({
            privateKey: serverEphemeralPrivateKey,
            publicKey: crypto.createPublicKey({
                key: clientPubKeyBytes,
                format: 'raw',
                type: 'spki'
            })
        });

        // Derive session key from shared secret
        const sessionKey = crypto.createHash('sha256').update(sharedSecret).digest();

        // Encrypt UMEK with session key
        const wrappedIv = crypto.randomBytes(12);
        const sessionCipher = crypto.createCipheriv('aes-256-gcm', sessionKey, wrappedIv);
        const wrappedUmek = Buffer.concat([
            sessionCipher.update(umekBytes),
            sessionCipher.final()
        ]);
        const wrappedAuthTag = sessionCipher.getAuthTag();

        return res.json({
            serverEphemeralPublicKey: serverEphemeralPublicKey.toString('base64'),
            wrappedUmek: wrappedUmek.toString('base64'),
            wrappedIv: wrappedIv.toString('base64'),
            wrappedAuthTag: wrappedAuthTag.toString('base64')
        });

    } catch (err) {
        console.error('❌ [unwrapUmekWithServerKEK] Error:', err);
        return res.status(500).json({
            message: 'Failed to unwrap UMEK'
        });
    }
};

/**
 * Rotate UMEK protection (password change or OAuth-to-password migration)
 * POST /api/v2/crypto/identity/rotate-umek
 * 
 * PHASE 2: Support password changes without regenerating identity keys
 * 
 * Flow:
 * 1. Client decrypts identity private key with OLD UMEK
 * 2. Client re-encrypts with NEW UMEK
 * 3. Client sends re-encrypted artifacts + version
 * 4. Server validates version (optimistic locking)
 * 5. Server updates UMEK protection (identity keys unchanged)
 */
exports.rotateUMEK = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            encryptedIdentityPrivateKey,
            identityPrivateKeyIv,
            umekSalt,
            umekProtectionType,
            currentVersion
        } = req.body;

        // Validate required fields
        if (!encryptedIdentityPrivateKey || !identityPrivateKeyIv || !umekProtectionType || currentVersion === undefined) {
            return res.status(400).json({
                message: 'Missing required fields: encryptedIdentityPrivateKey, identityPrivateKeyIv, umekProtectionType, currentVersion'
            });
        }

        // Validate umekProtectionType
        if (!['PASSWORD', 'SERVER_KEK'].includes(umekProtectionType)) {
            return res.status(400).json({
                message: 'Invalid umekProtectionType'
            });
        }

        // Validate PASSWORD protection has salt
        if (umekProtectionType === 'PASSWORD' && !umekSalt) {
            return res.status(400).json({
                message: 'umekSalt required for PASSWORD protection'
            });
        }

        // Fetch current crypto state
        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No crypto state found. Cannot rotate UMEK without existing identity.'
            });
        }

        // ⚠️ OPTIMISTIC LOCKING: Prevent concurrent updates
        if (cryptoState.version !== currentVersion) {
            console.warn(`⚠️ Version conflict for user ${userId}: current=${cryptoState.version}, provided=${currentVersion}`);
            return res.status(409).json({
                message: 'Version conflict. Another update occurred. Please fetch latest state and retry.',
                currentVersion: cryptoState.version,
                providedVersion: currentVersion
            });
        }

        console.log(`🔄 [PHASE 2] Rotating UMEK for user ${userId} (${cryptoState.umekProtectionType} → ${umekProtectionType})`);

        // Update UMEK protection (identity keys UNCHANGED)
        cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
        cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
        cryptoState.umekProtectionType = umekProtectionType;
        cryptoState.version += 1;

        // For PASSWORD protection: IRREVERSIBLE migration from SERVER_KEK
        if (umekProtectionType === 'PASSWORD') {
            cryptoState.umekSalt = umekSalt;

            // ⚠️ EXPLICITLY WIPE SERVER_KEK envelope (prevents downgrade attacks)
            const hadServerKEK = cryptoState.umekEnvelope !== null;
            cryptoState.umekEnvelope = null;
            cryptoState.umekEnvelopeIv = null;

            if (hadServerKEK) {
                console.log(`🔒 [PHASE 2] Wiped SERVER_KEK envelope for user ${userId} (migration is IRREVERSIBLE)`);
            }
        } else {

            // For SERVER_KEK protection (rare case: password → server KEK)
            cryptoState.umekSalt = null;
            // Note: umekEnvelope should be provided in this case via separate flow
        }

        cryptoState.updatedAt = new Date();

        await cryptoState.save();

        // PHASE 4A: Log UMEK rotation or migration (best-effort, non-blocking)
        let wasMigration = false;
        try {
            const securityAudit = require('../../services/securityAudit.service');
            wasMigration = hadServerKEK && umekProtectionType === 'PASSWORD';

            securityAudit.logSecurityEvent({
                userId,
                eventType: wasMigration ? 'OAUTH_TO_PASSWORD_MIGRATION' : 'UMEK_ROTATED',
                req,
                metadata: {
                    oldProtectionType: cryptoState.umekProtectionType,
                    newProtectionType: umekProtectionType,
                    newVersion: cryptoState.version
                }
            });
        } catch (_auditError) {
            // Silent fail (non-critical)
        }

        // PHASE 4B: Send notification for password change (best-effort, non-blocking)
        // Only notify for actual password changes, not OAuth migrations
        if (!wasMigration) {
            try {
                const User = require('../../models/User');
                const securityNotification = require('../../services/securityNotification.service');

                // Fetch user for email
                const user = await User.findById(userId).lean();

                if (user) {
                    securityNotification.sendSecurityNotification({
                        user,
                        eventType: 'PASSWORD_CHANGED',
                        auditEvent: {
                            deviceName: req.headers['user-agent'],
                            createdAt: new Date()
                        }
                    });
                }
            } catch (_notificationError) {
                // Silent fail (non-critical)
            }
        }

        console.log(`✅ [PHASE 2] UMEK rotated for user ${userId} (version ${cryptoState.version})`);
        console.log(`   - Identity keys: UNCHANGED ✅`);
        console.log(`   - UMEK protection: ${umekProtectionType}`);

        return res.json({
            success: true,
            newVersion: cryptoState.version,
            message: 'UMEK protection rotated successfully'
        });

    } catch (err) {
        console.error('❌ [rotateUMEK] Error:', err);
        return res.status(500).json({
            message: 'Failed to rotate UMEK protection'
        });
    }
};

