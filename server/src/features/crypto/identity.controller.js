const logger = require('../../../utils/logger');
const { cryptoState: cryptoStateRepo } = require('../../identity');
const { PASSWORD_DERIVED, decodeUmek, isUnsealedUmek, sealUmek, openUmek, wrapForDevice } = require('./umekEnvelope');

// The crypto state lives in PostgreSQL (user_crypto_state, next to the user row).
// Handlers below edit fields and save, as they did with the Mongo model.
function cryptoStateDoc(row) {
    if (!row) return null;
    const doc = { ...row };
    Object.defineProperty(doc, 'save', {
        enumerable: false,
        value: async () => Object.assign(doc, await cryptoStateRepo.upsert(doc.userId, doc)),
    });
    return doc;
}

const UserCryptoState = {
    async findOne({ userId }) { return cryptoStateDoc(await cryptoStateRepo.findByUserId(userId)); },
    async create(data) { return cryptoStateDoc(await cryptoStateRepo.upsert(data.userId, data)); },
};

exports.initIdentityCryptoState = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            identityPublicKey,
            encryptedIdentityPrivateKey,
            identityPrivateKeyIv,
            umekEnvelope,
            umekSalt,
            umekProtectionType,
            algorithm,
            version,
            allowOverwrite 
        } = req.body;

        
        if (!identityPublicKey || !encryptedIdentityPrivateKey || !identityPrivateKeyIv || !umekProtectionType) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        
        if (!['PASSWORD', 'SERVER_KEK'].includes(umekProtectionType)) {
            return res.status(400).json({
                message: 'Invalid umekProtectionType'
            });
        }

        
        if (umekProtectionType === 'PASSWORD' && !umekSalt) {
            return res.status(400).json({
                message: 'umekSalt required for PASSWORD protection'
            });
        }

        // Never store a usable UMEK: password accounts derive it on the device, and a
        // SERVER_KEK account's UMEK is kept sealed under the KEK.
        let umekBytes = null;
        if (umekProtectionType === 'SERVER_KEK') {
            try {
                umekBytes = decodeUmek(umekEnvelope);
            } catch {
                return res.status(400).json({
                    message: 'umekEnvelope must be the 32-byte UMEK for SERVER_KEK protection'
                });
            }
        }
        const { envelope: storedEnvelope, kekVersion } = umekBytes
            ? sealUmek(umekBytes)
            : { envelope: PASSWORD_DERIVED, kekVersion: null };

        
        let cryptoState = await UserCryptoState.findOne({ userId });

        if (cryptoState) {
            
            if (!allowOverwrite) {
                return res.status(409).json({
                    message: 'Identity crypto state already exists. Set allowOverwrite=true to rotate keys.',
                    currentVersion: cryptoState.version
                });
            }

            logger.info(`⚠️ Overwriting crypto state for user ${userId} (explicit recovery/rotation)`);

            
            cryptoState.identityPublicKey = identityPublicKey;
            cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
            cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
            cryptoState.umekEnvelope = storedEnvelope;
            cryptoState.umekEnvelopeIv = null;
            cryptoState.kekVersion = kekVersion;
            cryptoState.umekSalt = umekSalt || null;
            cryptoState.umekProtectionType = umekProtectionType;
            cryptoState.algorithm = algorithm || 'RSA-2048';
            cryptoState.version = (cryptoState.version || 1) + 1; 
            cryptoState.updatedAt = new Date();

            await cryptoState.save();

            logger.info(`✅ Updated crypto state for user ${userId} (version ${cryptoState.version})`);
        } else {
            
            cryptoState = await UserCryptoState.create({
                userId,
                identityPublicKey,
                encryptedIdentityPrivateKey,
                identityPrivateKeyIv,
                umekEnvelope: storedEnvelope,
                umekEnvelopeIv: null,
                umekSalt: umekSalt || null,
                umekProtectionType,
                kekVersion,
                algorithm: algorithm || 'RSA-2048',
                version: version || 1
            });

            logger.info(`✅ Created crypto state for user ${userId}`);
        }

        return res.json({
            message: 'Identity crypto state saved',
            version: cryptoState.version
        });

    } catch (err) {
        logger.error('❌ [initIdentityCryptoState] Error:', err);
        return res.status(500).json({
            message: 'Failed to save identity crypto state'
        });
    }
};

exports.getIdentityCryptoState = async (req, res) => {
    try {
        const userId = req.user.sub;

        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No identity crypto state found'
            });
        }

        
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
            
        }

        
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
        logger.error('❌ [getIdentityCryptoState] Error:', err);
        return res.status(500).json({
            message: 'Failed to fetch identity crypto state'
        });
    }
};

exports.unwrapUmekWithServerKEK = async (req, res) => {
    try {
        const userId = req.user.sub;
        // The stored envelope is used; any envelope in the body (older clients send one) is ignored.
        const { clientEphemeralPublicKey } = req.body;

        if (!clientEphemeralPublicKey) {
            return res.status(400).json({
                message: 'Missing clientEphemeralPublicKey'
            });
        }

        
        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No crypto state found'
            });
        }

        
        if (cryptoState.umekProtectionType !== 'SERVER_KEK') {
            logger.warn(`⚠️ Attempted SERVER_KEK unwrap for user ${userId} who has ${cryptoState.umekProtectionType} protection`);
            return res.status(403).json({
                message: 'This account uses password-based protection',
                code: 'WRONG_PROTECTION_TYPE'
            });
        }

        
        let umekBytes;
        if (isUnsealedUmek(cryptoState.umekEnvelope)) {
            // Written before envelopes were sealed; sealStoredUmeks seals these at boot.
            umekBytes = Buffer.from(cryptoState.umekEnvelope, 'base64');
        } else {
            try {
                umekBytes = openUmek(cryptoState.umekEnvelope, cryptoState.kekVersion);
            } catch (error) {
                logger.error(`❌ [unwrapUmekWithServerKEK] Cannot open UMEK for user ${userId} (KEK v${cryptoState.kekVersion || 1}):`, error.message);
                return res.status(500).json({
                    message: 'Server encryption key not available',
                    code: 'KEK_NOT_AVAILABLE'
                });
            }
        }

        
        try {
            return res.json(wrapForDevice(umekBytes, clientEphemeralPublicKey));
        } catch {
            return res.status(400).json({
                message: 'clientEphemeralPublicKey must be a raw P-256 public key'
            });
        }

    } catch (err) {
        logger.error('❌ [unwrapUmekWithServerKEK] Error:', err);
        return res.status(500).json({
            message: 'Failed to unwrap UMEK'
        });
    }
};

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

        
        if (!encryptedIdentityPrivateKey || !identityPrivateKeyIv || !umekProtectionType || currentVersion === undefined) {
            return res.status(400).json({
                message: 'Missing required fields: encryptedIdentityPrivateKey, identityPrivateKeyIv, umekProtectionType, currentVersion'
            });
        }

        
        if (!['PASSWORD', 'SERVER_KEK'].includes(umekProtectionType)) {
            return res.status(400).json({
                message: 'Invalid umekProtectionType'
            });
        }

        
        if (umekProtectionType === 'PASSWORD' && !umekSalt) {
            return res.status(400).json({
                message: 'umekSalt required for PASSWORD protection'
            });
        }

        
        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No crypto state found. Cannot rotate UMEK without existing identity.'
            });
        }

        
        if (cryptoState.version !== currentVersion) {
            logger.warn(`⚠️ Version conflict for user ${userId}: current=${cryptoState.version}, provided=${currentVersion}`);
            return res.status(409).json({
                message: 'Version conflict. Another update occurred. Please fetch latest state and retry.',
                currentVersion: cryptoState.version,
                providedVersion: currentVersion
            });
        }

        logger.info(`🔄 [PHASE 2] Rotating UMEK for user ${userId} (${cryptoState.umekProtectionType} → ${umekProtectionType})`);

        const oldProtectionType = cryptoState.umekProtectionType;
        const hadServerKEK = oldProtectionType === 'SERVER_KEK';

        
        cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
        cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
        cryptoState.umekProtectionType = umekProtectionType;
        cryptoState.version += 1;

        
        if (umekProtectionType === 'PASSWORD') {
            cryptoState.umekSalt = umekSalt;

            
            cryptoState.umekEnvelope = null;
            cryptoState.umekEnvelopeIv = null;
            cryptoState.kekVersion = null;

            if (hadServerKEK) {
                logger.info(`🔒 [PHASE 2] Wiped SERVER_KEK envelope for user ${userId} (migration is IRREVERSIBLE)`);
            }
        } else {

            
            cryptoState.umekSalt = null;
            
        }

        cryptoState.updatedAt = new Date();

        await cryptoState.save();

        
        let wasMigration = false;
        try {
            const securityAudit = require('../../services/securityAudit.service');
            wasMigration = hadServerKEK && umekProtectionType === 'PASSWORD';

            securityAudit.logSecurityEvent({
                userId,
                eventType: wasMigration ? 'OAUTH_TO_PASSWORD_MIGRATION' : 'UMEK_ROTATED',
                req,
                metadata: {
                    oldProtectionType,
                    newProtectionType: umekProtectionType,
                    newVersion: cryptoState.version
                }
            });
        } catch (_auditError) {
            
        }

        
        
        if (!wasMigration) {
            try {
                const { users } = require('../../identity');
                const securityNotification = require('../../services/securityNotification.service');

                
                const user = await users.findById(userId);

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
                
            }
        }

        logger.info(`✅ [PHASE 2] UMEK rotated for user ${userId} (version ${cryptoState.version})`);
        logger.info(`   - Identity keys: UNCHANGED ✅`);
        logger.info(`   - UMEK protection: ${umekProtectionType}`);

        return res.json({
            success: true,
            newVersion: cryptoState.version,
            message: 'UMEK protection rotated successfully'
        });

    } catch (err) {
        logger.error('❌ [rotateUMEK] Error:', err);
        return res.status(500).json({
            message: 'Failed to rotate UMEK protection'
        });
    }
};
