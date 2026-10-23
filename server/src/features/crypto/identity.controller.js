const logger = require('../../../utils/logger');
const bcrypt = require('bcryptjs');
const identity = require('../../identity');
const { cryptoState: cryptoStateRepo } = identity;
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

// How long after signing in on a device a password-locked account may move to automatic unlock.
const AUTO_UPGRADE_WINDOW_MS = 15 * 60 * 1000;

/**
 * May this request replace a password-locked identity with an automatically unlocked one
 * without the password? Only when the old key is password-locked (pre-2.1), the new one is
 * SERVER_KEK, and this device (X-Device-Id) signed in within the last 15 minutes and is not
 * signed out — a real sign-in just happened here, not an old session token being replayed.
 */
async function autoUpgradeAllowed(req, userId, cryptoState, newProtectionType) {
    if (cryptoState?.umekProtectionType !== 'PASSWORD' || newProtectionType !== 'SERVER_KEK') return false;
    try {
        const devices = require('../devices/devices.service');
        const deviceId = devices.deviceIdFrom(req);
        if (!deviceId) return false;
        const { query } = require('../../shared/postgres');
        const { rows } = await query(
            'SELECT revoked, meta FROM user_device_sessions WHERE user_id = $1 AND device_id = $2 LIMIT 1',
            [String(userId), deviceId]
        );
        const row = rows[0];
        if (!row || row.revoked) return false;
        const at = Date.parse(row.meta?.signInAt || '');
        return Number.isFinite(at) && Date.now() - at <= AUTO_UPGRADE_WINDOW_MS;
    } catch (err) {
        logger.warn({ err: err.message }, '[identity] auto-upgrade check failed');
        return false;
    }
}
exports._autoUpgradeAllowed = autoUpgradeAllowed;

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
            allowOverwrite,
            currentPassword,
            autoUpgrade
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

            // Replacing the keys (after a password reset) needs the account password, checked
            // here: a stolen session token alone must not be able to swap someone's keys.
            const account = await identity.users.findById(userId, { withSecrets: true });
            const passwordOk = Boolean(account?.passwordHash) && typeof currentPassword === 'string' && currentPassword.length > 0
                && await bcrypt.compare(currentPassword, account.passwordHash);
            // Accounts from before automatic unlock (2.1) still have a password-locked key, so
            // Google sign-in or a new device asked for the password. Right after a real sign-in
            // on this device they move to automatic unlock without it (see autoUpgradeAllowed).
            const upgradeOk = !passwordOk && autoUpgrade === true
                && await autoUpgradeAllowed(req, userId, cryptoState, umekProtectionType);
            if (upgradeOk) logger.info({ userId }, 'Password-locked encryption moved to automatic unlock after sign-in');
            if (!passwordOk && !upgradeOk) {
                return res.status(401).json({ message: 'Enter your current account password to set up encryption again.' });
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

            // Conversation keys wrapped for the old identity key can't be opened any more. Drop
            // them and wrap each conversation key again for the new public key (the server holds
            // them under its KEK), so the person gets their channels and DMs back.
            try {
                const { identityKeys, conversationKeys } = require('../../identity/keys.repo');
                await identityKeys.upsert(userId, { publicKey: identityPublicKey, algorithm: cryptoState.algorithm, version: cryptoState.version });
                const dropped = await conversationKeys.removeAllMemberKeysForUser(userId);
                const repaired = await require('../../modules/conversations/conversationKeys.service').repairUserConversationAccess(userId);
                logger.info({ userId, dropped, repaired: repaired?.repaired, dms: repaired?.dms }, 'Encryption set up again after password reset');
            } catch (err) {
                logger.error({ err: err.message, userId }, 'Re-granting conversation keys after key reset failed');
            }
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

        // Messages unlock automatically on every device: a key the server holds sealed stays that
        // way. Older apps ask to re-lock it with a new password; keep it as it is and say so.
        if (hadServerKEK && umekProtectionType === 'PASSWORD') {
            return res.json({
                success: true,
                newVersion: cryptoState.version,
                kept: 'SERVER_KEK',
                message: 'Your message key stays sealed on the server so your devices unlock automatically.'
            });
        }

        
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


/**
 * POST /api/v2/crypto/identity/seal-umek { umek }
 *
 * Moves a password-protected account to automatic unlock: a device that just opened the key with
 * the password sends the UMEK (32 bytes, base64, over TLS). The server checks it really opens the
 * stored private key, keeps it sealed under its KEK (like Google accounts) and from then on any
 * signed-in device gets it without a password. The identity key pair is unchanged.
 */
exports.sealUmek = async (req, res) => {
    try {
        const userId = req.user.sub;
        let umekBytes;
        try {
            umekBytes = decodeUmek(req.body?.umek);
        } catch {
            return res.status(400).json({ message: 'umek must be the 32-byte key (base64)' });
        }
        const cryptoState = await UserCryptoState.findOne({ userId });
        if (!cryptoState) return res.status(404).json({ message: 'No crypto state found' });
        if (cryptoState.umekProtectionType === 'SERVER_KEK') {
            return res.json({ success: true, umekProtectionType: 'SERVER_KEK', alreadySealed: true, version: cryptoState.version });
        }
        if (!opensPrivateKey(cryptoState, umekBytes)) {
            return res.status(400).json({ message: 'That key does not open your identity key.', code: 'UMEK_MISMATCH' });
        }
        const { envelope, kekVersion } = sealUmek(umekBytes);
        cryptoState.umekEnvelope = envelope;
        cryptoState.umekEnvelopeIv = null;
        cryptoState.kekVersion = kekVersion;
        cryptoState.umekSalt = null;
        cryptoState.umekProtectionType = 'SERVER_KEK';
        cryptoState.version = (cryptoState.version || 1) + 1;
        cryptoState.updatedAt = new Date();
        await cryptoState.save();
        try {
            require('../../services/securityAudit.service').logSecurityEvent({
                userId, eventType: 'UMEK_SEALED_FOR_AUTO_UNLOCK', req, metadata: { newVersion: cryptoState.version },
            });
        } catch (_auditError) { /* best effort */ }
        // Devices waiting on "unlock from another device" can now unwrap it themselves.
        try {
            require('../../socket/getIO').getIO()?.to(`user:${userId}`).emit('crypto:umek-sealed', { version: cryptoState.version });
        } catch (_e) { /* no sockets */ }
        logger.info(`🔐 [CRYPTO] Account ${userId} moved to automatic unlock (sealed UMEK, v${cryptoState.version})`);
        return res.json({ success: true, umekProtectionType: 'SERVER_KEK', version: cryptoState.version });
    } catch (err) {
        logger.error('❌ [sealUmek] Error:', err);
        return res.status(500).json({ message: 'Failed to seal key' });
    }
};

/** Does `umekBytes` decrypt the stored identity private key (AES-256-GCM, ciphertext || tag)? */
function opensPrivateKey(state, umekBytes) {
    try {
        const crypto = require('crypto');
        const data = Buffer.from(String(state.encryptedIdentityPrivateKey || ''), 'base64');
        const iv = Buffer.from(String(state.identityPrivateKeyIv || ''), 'base64');
        if (data.length < 17 || iv.length < 12) return false;
        const decipher = crypto.createDecipheriv('aes-256-gcm', umekBytes, iv);
        decipher.setAuthTag(data.subarray(data.length - 16));
        const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
        JSON.parse(plain.toString('utf8'));
        return true;
    } catch {
        return false;
    }
}
exports._opensPrivateKey = opensPrivateKey;

// ── Unlock from another device ─────────────────────────────────────────────
// A device whose account key is still password-protected asks another signed-in device to
// unlock it. That device enters the password once (it seals the key, see sealUmek) and approves;
// the asking device then unwraps the key from the server like any other.

function deviceOf(req) {
    const devices = require('../devices/devices.service');
    const c = devices.describeClient(req);
    return { deviceId: devices.deviceIdFrom(req), deviceName: c.deviceName, platform: c.platform, location: devices.approxLocation(req), ip: req.ip || null, method: 'unlock' };
}

/** POST /api/v2/crypto/unlock-requests -> { id, expiresAt } */
exports.createUnlockRequest = async (req, res) => {
    try {
        const userId = req.user.sub;
        const n = await require('../../shared/services/otpStore').incr(`unlock-req:${userId}`, 10 * 60 * 1000);
        if (n > 5) return res.status(429).json({ message: 'Too many requests. Try again in a few minutes.' });
        const approvals = require('../auth/approvals');
        const a = await approvals.create({ userId, kind: 'unlock', requester: deviceOf(req) });
        return res.json({ id: a.id, expiresAt: new Date(a.expiresAt).toISOString() });
    } catch (err) {
        logger.error('❌ [createUnlockRequest] Error:', err);
        return res.status(500).json({ message: 'Failed to ask your other devices' });
    }
};

/** GET /api/v2/crypto/unlock-requests/:id -> { status, umekProtectionType } (polled by the asking device) */
exports.getUnlockRequest = async (req, res) => {
    try {
        const approvals = require('../auth/approvals');
        const a = await approvals.get(req.params.id);
        const state = await UserCryptoState.findOne({ userId: req.user.sub });
        if (!a || a.userId !== String(req.user.sub)) {
            return res.json({ status: 'expired', umekProtectionType: state?.umekProtectionType || null });
        }
        return res.json({ status: a.status, umekProtectionType: state?.umekProtectionType || null });
    } catch (err) {
        logger.error('❌ [getUnlockRequest] Error:', err);
        return res.status(500).json({ message: 'Failed to read the request' });
    }
};

/**
 * POST /api/v2/crypto/unlock-requests/:id/decision { approve }
 * Approving needs the key to be sealed already (the approving device calls seal-umek first).
 */
exports.decideUnlockRequest = async (req, res) => {
    try {
        const approvals = require('../auth/approvals');
        const approve = req.body?.approve === true;
        if (approve) {
            const state = await UserCryptoState.findOne({ userId: req.user.sub });
            if (state?.umekProtectionType !== 'SERVER_KEK') {
                return res.status(409).json({ code: 'UMEK_NOT_SEALED', message: 'Enter your password on this device first.' });
            }
        }
        const devices = require('../devices/devices.service');
        const approver = { userId: String(req.user.sub), deviceId: devices.deviceIdFrom(req), deviceName: devices.describeClient(req).deviceName };
        const a = await approvals.decide(req.params.id, approver, approve, undefined, { allowKinds: ['unlock'] });
        return res.json({ approval: approvals.publicView(a) });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
        logger.error('❌ [decideUnlockRequest] Error:', err);
        return res.status(500).json({ message: 'Failed to answer the request' });
    }
};
