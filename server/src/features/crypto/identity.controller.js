const crypto = require('crypto');
const UserCryptoState = require('../../models/UserCryptoState');

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
            allowOverwrite 
        } = req.body;

        
        if (!identityPublicKey || !encryptedIdentityPrivateKey || !identityPrivateKeyIv || !umekEnvelope || !umekProtectionType) {
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

        
        let cryptoState = await UserCryptoState.findOne({ userId });

        if (cryptoState) {
            
            if (!allowOverwrite) {
                return res.status(409).json({
                    message: 'Identity crypto state already exists. Set allowOverwrite=true to rotate keys.',
                    currentVersion: cryptoState.version
                });
            }

            console.log(`⚠️ Overwriting crypto state for user ${userId} (explicit recovery/rotation)`);

            
            cryptoState.identityPublicKey = identityPublicKey;
            cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
            cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
            cryptoState.umekEnvelope = umekEnvelope;
            cryptoState.umekEnvelopeIv = umekEnvelopeIv || null;
            cryptoState.umekSalt = umekSalt || null;
            cryptoState.umekProtectionType = umekProtectionType;
            cryptoState.algorithm = algorithm || 'X25519';
            cryptoState.version = (cryptoState.version || 1) + 1; 
            cryptoState.updatedAt = new Date();

            await cryptoState.save();

            console.log(`✅ Updated crypto state for user ${userId} (version ${cryptoState.version})`);
        } else {
            
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
        console.error('❌ [getIdentityCryptoState] Error:', err);
        return res.status(500).json({
            message: 'Failed to fetch identity crypto state'
        });
    }
};

exports.wrapUmekWithServerKEK = (umekBytes) => {
    try {
        const kekManager = require('../../services/kekManager.service');
        const { version, key } = kekManager.getActiveKEK();

        console.log(`🔐 [PHASE 4D] Wrapping UMEK with KEK version ${version}`);

        
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

        
        const envelope = Buffer.concat([iv, authTag, encrypted]).toString('base64');

        return { envelope, kekVersion: version };
    } catch (err) {
        console.error('❌ [wrapUmekWithServerKEK] Error:', err);
        throw new Error('Failed to wrap UMEK');
    }
};

exports.unwrapUmekWithServerKEK = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { umekEnvelope, clientEphemeralPublicKey } = req.body;

        if (!umekEnvelope || !clientEphemeralPublicKey) {
            return res.status(400).json({
                message: 'Missing umekEnvelope or clientEphemeralPublicKey'
            });
        }

        
        const cryptoState = await UserCryptoState.findOne({ userId });

        if (!cryptoState) {
            return res.status(404).json({
                message: 'No crypto state found'
            });
        }

        
        if (cryptoState.umekProtectionType !== 'SERVER_KEK') {
            console.warn(`⚠️ Attempted SERVER_KEK unwrap for user ${userId} who has ${cryptoState.umekProtectionType} protection`);
            return res.status(403).json({
                message: 'This account uses password-based protection',
                code: 'WRONG_PROTECTION_TYPE'
            });
        }

        
        const kekManager = require('../../services/kekManager.service');
        const kekVersion = cryptoState.kekVersion || 1;  

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

        
        

        
        const clientPubKeyBytes = Buffer.from(clientEphemeralPublicKey, 'base64');

        
        const { publicKey: serverEphemeralPublicKey, privateKey: serverEphemeralPrivateKey } =
            crypto.generateKeyPairSync('x25519');

        
        const sharedSecret = crypto.diffieHellman({
            privateKey: serverEphemeralPrivateKey,
            publicKey: crypto.createPublicKey({
                key: clientPubKeyBytes,
                format: 'raw',
                type: 'spki'
            })
        });

        
        const sessionKey = crypto.createHash('sha256').update(sharedSecret).digest();

        
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
            console.warn(`⚠️ Version conflict for user ${userId}: current=${cryptoState.version}, provided=${currentVersion}`);
            return res.status(409).json({
                message: 'Version conflict. Another update occurred. Please fetch latest state and retry.',
                currentVersion: cryptoState.version,
                providedVersion: currentVersion
            });
        }

        console.log(`🔄 [PHASE 2] Rotating UMEK for user ${userId} (${cryptoState.umekProtectionType} → ${umekProtectionType})`);

        
        cryptoState.encryptedIdentityPrivateKey = encryptedIdentityPrivateKey;
        cryptoState.identityPrivateKeyIv = identityPrivateKeyIv;
        cryptoState.umekProtectionType = umekProtectionType;
        cryptoState.version += 1;

        
        if (umekProtectionType === 'PASSWORD') {
            cryptoState.umekSalt = umekSalt;

            
            const hadServerKEK = cryptoState.umekEnvelope !== null;
            cryptoState.umekEnvelope = null;
            cryptoState.umekEnvelopeIv = null;

            if (hadServerKEK) {
                console.log(`🔒 [PHASE 2] Wiped SERVER_KEK envelope for user ${userId} (migration is IRREVERSIBLE)`);
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
                    oldProtectionType: cryptoState.umekProtectionType,
                    newProtectionType: umekProtectionType,
                    newVersion: cryptoState.version
                }
            });
        } catch (_auditError) {
            
        }

        
        
        if (!wasMigration) {
            try {
                const User = require('../../models/User');
                const securityNotification = require('../../services/securityNotification.service');

                
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
