const logger = require('../../../utils/logger');
const crypto = require('crypto');
// Keys live in PostgreSQL next to the users they belong to (identity/keys.repo); the
// document adapter keeps the push-then-save style this service is written in.
const { conversationKeyDocs: ConversationKey } = require('../../identity/queries/auth');
const { identityKeys: UserIdentityKey } = require('../../identity');
const cryptoUtils = require('./cryptoUtils');

async function storeConversationKeys(params) {
    const { conversationId, conversationType, workspaceId, createdBy, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag, session } = params;

    try {
        
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);

        if (existing) {
            throw new Error('Conversation keys already exist. Use addParticipant to add new users.');
        }

        
        const createOptions = {
            conversationId,
            conversationType,
            workspaceId,
            createdBy,
            encryptedKeys,
            workspaceEncryptedKey,
            workspaceKeyIv,
            workspaceKeyAuthTag,
            version: 1,
            isActive: true
        };

        // Keys are in PostgreSQL: a Mongo `session` from the caller cannot cover this write.
        void session;
        const conversationKey = await ConversationKey.create(createOptions);

        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.info(`🔐 [PHASE 3] Conversation key stored for ${conversationType}:${conversationId}`);
        logger.info(`📥 [PHASE 3] Members encrypted: ${encryptedKeys.length}`);
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return conversationKey;
    } catch (error) {
        logger.error('Failed to store conversation keys:', error);
        throw error;
    }
}

async function getUserConversationKey(conversationId, conversationType, userId) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            return null;
        }

        
        if (!conversationKey.hasAccess(userId)) {
            
            logger.info(`User ${userId} does not have access to ${conversationType}:${conversationId}`);
            return null;
        }

        
        const encryptedKeyData = conversationKey.getEncryptedKeyForUser(userId);

        if (!encryptedKeyData) {
            logger.info(`No encrypted key found for user ${userId} in ${conversationType}:${conversationId}`);
            return null;
        }

        return {
            conversationId: conversationKey.conversationId,
            conversationType: conversationKey.conversationType,
            encryptedKey: encryptedKeyData.encryptedKey,
            ephemeralPublicKey: encryptedKeyData.ephemeralPublicKey,
            algorithm: encryptedKeyData.algorithm,
            version: conversationKey.version
        };
    } catch (error) {
        logger.error('Failed to get user conversation key:', error);
        throw error;
    }
}

async function getUserWorkspaceConversationKeys(userId, workspaceId) {
    try {
        const conversationKeys = await ConversationKey.findByUser(userId, workspaceId);

        return conversationKeys.map(ck => {
            const encryptedKeyData = ck.getEncryptedKeyForUser(userId);
            return {
                conversationId: ck.conversationId,
                conversationType: ck.conversationType,
                encryptedKey: encryptedKeyData.encryptedKey,
                ephemeralPublicKey: encryptedKeyData.ephemeralPublicKey,
                algorithm: encryptedKeyData.algorithm,
                version: ck.version
            };
        });
    } catch (error) {
        logger.error('Failed to get user workspace conversation keys:', error);
        throw error;
    }
}

async function addParticipant(conversationId, conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        
        if (conversationKey.hasAccess(userId)) {
            logger.info(`User ${userId} already has access to ${conversationType}:${conversationId}`);
            return conversationKey;
        }

        
        conversationKey.encryptedKeys.push({
            userId,
            encryptedKey,
            ephemeralPublicKey,
            algorithm,
            addedAt: new Date()
        });

        await conversationKey.save();

        logger.info(`✅ Added participant ${userId} to ${conversationType}:${conversationId}`);
        return conversationKey;
    } catch (error) {
        logger.error('Failed to add participant:', error);
        throw error;
    }
}

async function removeParticipant(conversationId, conversationType, userId) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        
        const initialLength = conversationKey.encryptedKeys.length;
        conversationKey.encryptedKeys = conversationKey.encryptedKeys.filter(
            ek => ek.userId.toString() !== userId.toString()
        );

        if (conversationKey.encryptedKeys.length === initialLength) {
            logger.info(`User ${userId} not found in ${conversationType}:${conversationId}`);
            return false;
        }

        await conversationKey.save();

        logger.info(`🗑️ Removed participant ${userId} from ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        logger.error('Failed to remove participant:', error);
        throw error;
    }
}

async function addEncryptedKeyForUser(conversationId, conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        
        if (conversationKey.hasAccess(userId)) {
            logger.info(`User ${userId} already has access to ${conversationType}:${conversationId}`);
            return true;
        }

        
        conversationKey.encryptedKeys.push({
            userId,
            encryptedKey,
            ephemeralPublicKey: ephemeralPublicKey || undefined,
            algorithm
        });

        await conversationKey.save();

        logger.info(`✅ Added encrypted key for user ${userId} in ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        logger.error('Failed to add encrypted key for user:', error);
        throw error;
    }
}

async function distributeKeyToNewMember(conversationId, conversationType, newUserId) {
    try {
        logger.info(`🔐 [Server Distribution] Distributing key for ${conversationType}:${conversationId} to user ${newUserId}`);

        
        
        
        logger.info(`🔗 [AUDIT][PHASE1][DISTRIBUTE] Key distribution request received`);
        logger.info(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        logger.info(`   ├─ Target user: ${newUserId}`);
        logger.info(`   └─ Timestamp: ${new Date().toISOString()}`);

        
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            logger.error(`❌ [Server Distribution] No conversation key found for ${conversationType}:${conversationId}`);
            
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] CRITICAL: No conversation key exists`);
            logger.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            logger.error(`   ├─ Target user: ${newUserId}`);
            logger.error(`   ├─ Reason: ConversationKey document NOT FOUND in database`);
            logger.error(`   └─ This channel was NEVER encrypted (Phase 5 failed or skipped)`);
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        if (conversationKey.hasAccess(newUserId)) {
            logger.info(`ℹ️ [PHASE 4] User ${newUserId} already has conversation key`);
            
            logger.info(`✅ [AUDIT][PHASE1][DISTRIBUTE] User already has key (idempotent)`);
            logger.info(`   ├─ User: ${newUserId}`);
            logger.info(`   └─ Already in encryptedKeys[] - no action needed`);
            return true;
        }

        
        let conversationKeyBytes;

        if (!conversationKey.workspaceEncryptedKey) {
            logger.warn(`⚠️ [PHASE 4] Legacy conversation key detected (not workspace-wrapped) for ${conversationType}:${conversationId}`);

            
            
            
            
            logger.error(`❌ [PHASE 4] Cannot distribute legacy unwrapped key - requires client-side re-sharing`);
            logger.error(`   Solution: Original member must re-encrypt key for new member via client`);

            
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.error(`⚠️ [AUDIT][PHASE1][DISTRIBUTE] LEGACY KEY DETECTED`);
            logger.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            logger.error(`   ├─ Target user: ${newUserId}`);
            logger.error(`   ├─ Missing: workspaceEncryptedKey field`);
            logger.error(`   ├─ Reason: Channel created BEFORE workspace wrapping was enforced`);
            logger.error(`   ├─ Server cannot decrypt: Needs user's private key`);
            logger.error(`   └─ Solution: Client-side key re-sharing required`);
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        const newUserKeyDoc = await UserIdentityKey.findByUserId(newUserId);

        if (!newUserKeyDoc || !newUserKeyDoc.publicKey) {
            logger.error(`❌ [Server Distribution] User ${newUserId} has no E2EE public key`);
            
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] User has no E2EE public key`);
            logger.error(`   ├─ User: ${newUserId}`);
            logger.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            logger.error(`   ├─ Reason: UserIdentityKey NOT FOUND or publicKey missing`);
            logger.error(`   └─ Cannot encrypt key for this user`);
            logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        logger.info(`🔓 [Server Distribution] Unwrapping conversation key with SERVER_KEK...`);
        conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
            conversationKey.workspaceEncryptedKey,
            conversationKey.workspaceKeyIv,
            conversationKey.workspaceKeyAuthTag
        );

        
        logger.info(`🔐 [Server Distribution] Re-encrypting for user ${newUserId}...`);
        const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, newUserKeyDoc.publicKey);

        
        conversationKey.encryptedKeys.push({
            userId: newUserId,
            encryptedKey: wrapped.encryptedKey,
            algorithm: wrapped.algorithm
        });

        await conversationKey.save();

        logger.info(`✅ [PHASE 4] Distributed conversation key for ${conversationType}:${conversationId} to user ${newUserId}`);

        
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`✅ [AUDIT][PHASE1][DISTRIBUTE] Key distribution SUCCESS`);
        logger.info(`   ├─ User: ${newUserId}`);
        logger.info(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        logger.info(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        logger.info(`   ├─ User added to encryptedKeys[] array`);
        logger.info(`   └─ INV-001 gap closed for this user`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return true;

    } catch (error) {
        logger.error(`❌ [Server Distribution] Failed to distribute key:`, error);
        
        logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] Distribution EXCEPTION`);
        logger.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        logger.error(`   ├─ Target user: ${newUserId}`);
        logger.error(`   ├─ Error message: ${error.message}`);
        logger.error(`   ├─ Error stack: ${error.stack}`);
        logger.error(`   └─ Returning false (distribution failed)`);
        logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return false;
    }

}

async function hasConversationKeys(conversationId, conversationType) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);
        return conversationKey !== null;
    } catch (error) {
        logger.error('Failed to check conversation keys:', error);
        return false;
    }
}

async function bootstrapConversationKey({ conversationId, conversationType, workspaceId, members }) {
    try {
        logger.info(`🔐 [Bootstrap] Creating conversation key for ${conversationType}:${conversationId}`);

        
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);
        if (existing) {
            logger.info(`✅ Conversation key already exists for ${conversationType}:${conversationId}`);
            return existing;
        }

        
        const conversationKey = crypto.randomBytes(32);

        
        const workspaceWrapped = cryptoUtils.encryptWithWorkspaceKey(conversationKey, workspaceId);

        
        const identityKeys = await UserIdentityKey.batchFindByUserIds(members);

        
        const publicKeyMap = new Map();
        identityKeys.forEach(k => publicKeyMap.set(k.userId.toString(), k));

        const encryptedKeys = [];
        for (const userId of members) {
            const keyDoc = publicKeyMap.get(userId.toString());

            if (!keyDoc || !keyDoc.publicKey) {
                logger.warn(`⚠️ User ${userId} has no E2EE public key, skipping`);
                continue;
            }

            // One bad public key must not stop the conversation from getting a key;
            // that user is picked up later by distributeKeyToNewMember.
            try {
                const wrapped = cryptoUtils.wrapForUser(conversationKey, keyDoc.publicKey);
                encryptedKeys.push({
                    userId: userId.toString(),
                    encryptedKey: wrapped.encryptedKey,
                    algorithm: wrapped.algorithm
                });
            } catch (wrapErr) {
                logger.warn(`⚠️ [Bootstrap] Could not wrap key for user ${userId}: ${wrapErr.message}`);
            }
        }

        
        
        
        if (encryptedKeys.length === 0) {
            logger.warn(`⚠️ [Bootstrap] No users with E2EE keys found for ${conversationType}:${conversationId}`);
            logger.warn(`   Creating conversation key with workspace wrapping only`);
            logger.warn(`   User-specific keys will be distributed when users upload public keys`);
        }

        
        
        
        let conversationKeyDoc;
        try {
            conversationKeyDoc = await ConversationKey.create({
                conversationId,
                conversationType,
                workspaceId,
                createdBy: members[0],
                encryptedKeys,
                workspaceEncryptedKey: workspaceWrapped.ciphertext,
                workspaceKeyIv: workspaceWrapped.iv,
                workspaceKeyAuthTag: workspaceWrapped.authTag,
                version: 1,
                isActive: true
            });
        } catch (createErr) {
            // Two requests bootstrapped the same conversation at once: keep the winner's key.
            if (createErr.code === 11000) {
                const winner = await ConversationKey.findByConversation(conversationId, conversationType);
                if (winner) return winner;
            }
            throw createErr;
        }

        logger.info(`✅ [Bootstrap] Conversation key created for ${conversationType}:${conversationId} (${encryptedKeys.length} users)`);
        return conversationKeyDoc;

    } catch (error) {
        logger.error(`❌ [Bootstrap] Failed to create conversation key:`, error);
        throw error;
    }
}

async function generateConversationKeyServerSide(conversationId, conversationType, workspaceId, members, creatorId, session = null) {
    try {
        
        
        
        logger.info(`🔐 [PHASE 5] Generating conversation key at channel birth for ${conversationId}`);
        logger.info(`📊 [AUDIT][PHASE1][CREATION] Channel key generation starting`);
        logger.info(`   ├─ Channel ID: ${conversationId}`);
        logger.info(`   ├─ Conversation Type: ${conversationType}`);
        logger.info(`   ├─ Workspace ID: ${workspaceId}`);
        logger.info(`   ├─ Total members: ${members.length}`);
        logger.info(`   ├─ Members list: ${JSON.stringify(members)}`);
        logger.info(`   ├─ Creator ID: ${creatorId}`);
        logger.info(`   └─ Timestamp: ${new Date().toISOString()}`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        
        const conversationKeyBytes = crypto.randomBytes(32);
        logger.info(`✅ [PHASE 5] Generated random AES-256 conversation key`);

        
        const workspaceWrapped = cryptoUtils.encryptWithWorkspaceKey(conversationKeyBytes, workspaceId);
        logger.info(`✅ [PHASE 5] Wrapped conversation key with workspace key`);

        
        const identityKeys = await UserIdentityKey.batchFindByUserIds(members);

        
        const publicKeyMap = new Map();
        identityKeys.forEach(k => publicKeyMap.set(k.userId.toString(), k));

        
        const encryptedKeys = [];
        let creatorHasKey = false;

        
        const skippedMembers = [];

        for (const userId of members) {
            const keyDoc = publicKeyMap.get(userId.toString());

            if (!keyDoc || !keyDoc.publicKey) {
                logger.warn(`⚠️ [PHASE 5] User ${userId} has no E2EE public key, skipping`);
                
                skippedMembers.push({ userId: userId.toString(), reason: 'MISSING_PUBLIC_KEY' });
                continue;
            }

            
            const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, keyDoc.publicKey);
            encryptedKeys.push({
                userId: userId.toString(),
                encryptedKey: wrapped.encryptedKey,
                algorithm: wrapped.algorithm
            });

            logger.info(`✅ [PHASE 5] Encrypted conversation key for user ${userId}`);

            
            if (userId.toString() === creatorId.toString()) {
                creatorHasKey = true;
            }
        }

        
        
        
        if (!creatorHasKey) {
            logger.warn(`⚠️ [PHASE 5] Creator ${creatorId} has no E2EE key - channel will be encrypted when identity is available`);
            logger.warn(`   Channel created with workspace wrapping only`);
            logger.warn(`   Keys will be distributed via automatic repair when creator's identity is uploaded`);
            logger.warn(`   ⚠️ INVARIANT: Channel will be READ-ONLY until repair completes (enforced by client-side guards)`);
            
        }

        
        if (encryptedKeys.length < members.length) {
            logger.warn(`⚠️ [PHASE 5] ${members.length - encryptedKeys.length} members without E2EE keys will not have access`);
        }

        
        
        
        const coveragePercent = Math.round((encryptedKeys.length / members.length) * 100);
        logger.info(`📊 [AUDIT][PHASE1][CREATION] Key generation complete`);
        logger.info(`   ├─ Channel ID: ${conversationId}`);
        logger.info(`   ├─ Total members in channel.members: ${members.length}`);
        logger.info(`   ├─ Keys generated in encryptedKeys[]: ${encryptedKeys.length}`);
        logger.info(`   ├─ Coverage: ${coveragePercent}% (${encryptedKeys.length}/${members.length})`);

        if (skippedMembers.length > 0) {
            logger.warn(`   ├─ ⚠️ INVARIANT VIOLATION DETECTED`);
            logger.warn(`   ├─ INV-001 broken: ${skippedMembers.length} members WITHOUT keys`);
            logger.warn(`   ├─ Skipped members: ${JSON.stringify(skippedMembers)}`);
            logger.warn(`   └─ These users are IN channel.members but NOT IN encryptedKeys[]`);
        } else {
            logger.info(`   └─ ✅ INV-001 satisfied: All members have keys`);
        }
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        
        await storeConversationKeys({
            conversationId,
            conversationType,
            workspaceId,
            createdBy: creatorId,
            encryptedKeys,  
            workspaceEncryptedKey: workspaceWrapped.ciphertext,
            workspaceKeyIv: workspaceWrapped.iv,
            workspaceKeyAuthTag: workspaceWrapped.authTag,
            session  
        });

        logger.info(`✅ [PHASE 5] Conversation key created and stored at channel birth for ${conversationId} (${encryptedKeys.length} users)`);
        return true;

    } catch (error) {
        logger.error(`❌ [PHASE 5] Failed to generate conversation key:`, error);
        throw error;
    }
}

async function repairConversationKeyForUser(channelId, userId) {
    const Channel = require("../../features/channels/channel.model.js");

    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`🔧 [PHASE2][REPAIR] Repair request received`);
    logger.info(`   ├─ Channel: ${channelId}`);
    logger.info(`   ├─ User: ${userId}`);
    logger.info(`   └─ Timestamp: ${new Date().toISOString()}`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        
        
        
        logger.info(`🔍 [PHASE2][REPAIR][GATE-1] Checking conversation key existence...`);

        const conversationKey = await ConversationKey.findByConversation(channelId, 'channel');

        if (!conversationKey) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: No conversation key found`);
            logger.error(`   ├─ Channel was never encrypted (Phase 5 failure)`);
            logger.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Conversation key document does not exist'
            };
        }

        if (!conversationKey.workspaceEncryptedKey) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: Legacy key (no workspace wrapping)`);
            logger.error(`   ├─ Channel has legacy key without SERVER_KEK wrapping`);
            logger.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Legacy key without workspace wrapping'
            };
        }

        logger.info(`✅ [PHASE2][REPAIR][GATE-1] PASSED ✓`);
        logger.info(`   ├─ Conversation key exists: YES`);
        logger.info(`   └─ Workspace-wrapped: YES`);

        
        
        
        logger.info(`🔍 [PHASE2][REPAIR][GATE-2] Checking channel membership...`);

        const channel = await Channel.findById(channelId).select('members');

        if (!channel) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: Channel not found`);
            return {
                result: 'CANNOT_REPAIR_NOT_A_MEMBER',
                reason: 'Channel does not exist'
            };
        }

        const isMember = channel.members.some(m => {
            const memberId = m.user ? m.user.toString() : m.toString();
            return memberId === userId.toString();
        });

        if (!isMember) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: User not in channel.members[]`);
            logger.error(`   ├─ User: ${userId}`);
            logger.error(`   ├─ Channel: ${channelId}`);
            logger.error(`   └─ Result: CANNOT_REPAIR_NOT_A_MEMBER`);
            return {
                result: 'CANNOT_REPAIR_NOT_A_MEMBER',
                reason: 'User is not a member of this channel'
            };
        }

        logger.info(`✅ [PHASE2][REPAIR][GATE-2] PASSED ✓`);
        logger.info(`   └─ User is in channel.members[]: YES`);

        
        
        
        logger.info(`🔍 [PHASE2][REPAIR][GATE-3] Checking if user already has key...`);

        const userHasKey = conversationKey.encryptedKeys.some(ek =>
            ek.userId.toString() === userId.toString()
        );

        if (userHasKey) {
            logger.info(`ℹ️ [PHASE2][REPAIR][GATE-3] User already has key (idempotent)`);
            logger.info(`   ├─ User: ${userId}`);
            logger.info(`   ├─ Already in encryptedKeys[]: YES`);
            logger.info(`   └─ Result: NO_REPAIR_NEEDED`);
            return {
                result: 'NO_REPAIR_NEEDED',
                reason: 'User already has encryption key'
            };
        }

        logger.info(`✅ [PHASE2][REPAIR][GATE-3] PASSED ✓`);
        logger.info(`   ├─ User in encryptedKeys[]: NO`);
        logger.info(`   └─ INV-001 violation confirmed - repair needed`);

        
        
        
        logger.info(`🔍 [PHASE2][REPAIR][GATE-4] Checking user's E2EE public key...`);

        const userIdentityKey = await UserIdentityKey.findByUserId(userId);

        if (!userIdentityKey || !userIdentityKey.publicKey) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-4] FAILED: User has no E2EE public key`);
            logger.error(`   ├─ User: ${userId}`);
            logger.error(`   ├─ UserIdentityKey exists: ${!!userIdentityKey}`);
            logger.error(`   ├─ Public key exists: NO`);
            logger.error(`   └─ Result: CANNOT_REPAIR_MISSING_PUBLIC_KEY`);
            return {
                result: 'CANNOT_REPAIR_MISSING_PUBLIC_KEY',
                reason: 'User has no E2EE identity key'
            };
        }

        logger.info(`✅ [PHASE2][REPAIR][GATE-4] PASSED ✓`);
        logger.info(`   ├─ User has E2EE public key: YES`);
        logger.info(`   └─ Algorithm: ${userIdentityKey.algorithm}`);

        
        
        
        logger.info(`🔍 [PHASE2][REPAIR][GATE-5] Unwrapping conversation key with SERVER_KEK...`);

        let conversationKeyBytes;
        try {
            conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
                conversationKey.workspaceEncryptedKey,
                conversationKey.workspaceKeyIv,
                conversationKey.workspaceKeyAuthTag
            );

            if (!conversationKeyBytes || conversationKeyBytes.length !== 32) {
                throw new Error('Invalid conversation key bytes');
            }

        } catch (unwrapError) {
            logger.error(`❌ [PHASE2][REPAIR][GATE-5] FAILED: Cannot unwrap conversation key`);
            logger.error(`   ├─ Error: ${unwrapError.message}`);
            logger.error(`   ├─ Channel: ${channelId}`);
            logger.error(`   └─ Result: CANNOT_REPAIR_UNWRAP_FAILED`);
            return {
                result: 'CANNOT_REPAIR_UNWRAP_FAILED',
                reason: `Unwrap failed: ${unwrapError.message}`
            };
        }

        logger.info(`✅ [PHASE2][REPAIR][GATE-5] PASSED ✓`);
        logger.info(`   ├─ Conversation key unwrapped successfully`);
        logger.info(`   └─ Key size: 32 bytes (AES-256)`);

        
        
        
        logger.info(`🔧 [PHASE2][REPAIR] ALL GATES PASSED - Proceeding with repair`);
        logger.info(`   ├─ User: ${userId}`);
        logger.info(`   └─ Channel: ${channelId}`);

        
        const wrapped = cryptoUtils.wrapForUser(
            conversationKeyBytes,
            userIdentityKey.publicKey
        );

        
        conversationKey.encryptedKeys.push({
            userId: userId,
            encryptedKey: wrapped.encryptedKey,
            algorithm: wrapped.algorithm
        });

        await conversationKey.save();

        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`✅ [PHASE2][REPAIR] REPAIR SUCCESS`);
        logger.info(`   ├─ User: ${userId}`);
        logger.info(`   ├─ Channel: ${channelId}`);
        logger.info(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        logger.info(`   ├─ Added to encryptedKeys[]: YES`);
        logger.info(`   ├─ INV-001 violation REPAIRED`);
        logger.info(`   └─ User can now: Fetch key, decrypt messages, send messages`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'REPAIR_SUCCESS',
            userId: userId,
            channelId: channelId,
            algorithm: wrapped.algorithm
        };

    } catch (error) {
        logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.error(`❌ [PHASE2][REPAIR] EXCEPTION during repair`);
        logger.error(`   ├─ User: ${userId}`);
        logger.error(`   ├─ Channel: ${channelId}`);
        logger.error(`   ├─ Error: ${error.message}`);
        logger.error(`   └─ Stack: ${error.stack}`);
        logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'CANNOT_REPAIR_EXCEPTION',
            reason: error.message,
            error: error.message
        };
    }

}

/**
 * Make sure a DM has a conversation key and that every participant can open it.
 * Creates the key if it is missing and distributes it (via SERVER_KEK) to any
 * participant who is not in encryptedKeys yet, e.g. someone who had no identity
 * key when the DM was created. Safe to call on every key fetch.
 */
async function ensureDMConversationKey(dmSessionId, requestingUserId = null) {
    const mongoose = require('mongoose');
    const DMSession = require('../../../models/DMSession');

    if (!mongoose.isValidObjectId(String(dmSessionId))) return { status: 'NOT_FOUND' };

    const dm = await DMSession.findById(dmSessionId).select('participants workspace').lean();
    if (!dm) return { status: 'NOT_FOUND' };

    const participants = (dm.participants || []).map(String);
    if (requestingUserId && !participants.includes(String(requestingUserId))) {
        return { status: 'NOT_PARTICIPANT' };
    }

    const existing = await ConversationKey.findByConversation(dm._id, 'dm');
    if (!existing) {
        await bootstrapConversationKey({
            conversationId: dm._id,
            conversationType: 'dm',
            workspaceId: dm.workspace,
            members: participants
        });
        return { status: 'CREATED' };
    }

    const missing = participants.filter(p => !existing.hasAccess(p));
    let distributed = 0;
    for (const userId of missing) {
        if (await distributeKeyToNewMember(dm._id, 'dm', userId)) distributed++;
    }
    return { status: 'OK', missing: missing.length, distributed };
}

/** Is `userId` a member of the channel / participant of the DM? */
async function isConversationMember(conversationId, conversationType, userId) {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(String(conversationId)) || !userId) return false;
    const me = String(userId);

    if (conversationType === 'dm') {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(conversationId).select('participants').lean();
        return !!dm && (dm.participants || []).some(p => String(p) === me);
    }

    const Channel = require("../../features/channels/channel.model.js");
    const channel = await Channel.findById(conversationId).select('members').lean();
    return !!channel && (channel.members || []).some(m => String(m?.user?._id || m?.user || m) === me);
}

async function repairUserConversationAccess(userId) {
    logger.info(`🔧 [AUTO-REPAIR] Starting automatic repair for user ${userId}...`);

    const Channel = require("../../features/channels/channel.model.js");
    const DMSession = require('../../../models/DMSession');

    try {
        
        const userChannels = await Channel.find({
            'members.user': userId
        }).select('_id name workspace');

        logger.info(`📊 [AUTO-REPAIR] Found ${userChannels.length} channels for user ${userId}`);

        const results = {
            total: userChannels.length,
            repaired: 0,
            alreadyHasKey: 0,
            failed: 0,
            details: []
        };

        for (const channel of userChannels) {
            const result = await repairConversationKeyForUser(channel._id.toString(), userId);

            if (result.result === 'REPAIR_SUCCESS') {
                results.repaired++;
                results.details.push({
                    channelId: channel._id,
                    channelName: channel.name,
                    status: 'repaired'
                });
            } else if (result.result === 'NO_REPAIR_NEEDED') {
                results.alreadyHasKey++;
            } else {
                results.failed++;
                results.details.push({
                    channelId: channel._id,
                    channelName: channel.name,
                    status: 'failed',
                    reason: result.reason
                });
            }
        }

        const userDMs = await DMSession.find({ participants: userId }).select('_id').lean();
        results.dms = { total: userDMs.length, repaired: 0, failed: 0 };
        for (const dm of userDMs) {
            try {
                const r = await ensureDMConversationKey(dm._id, userId);
                if (r.status === 'CREATED' || r.distributed > 0) results.dms.repaired++;
            } catch (dmErr) {
                results.dms.failed++;
                logger.warn(`⚠️ [AUTO-REPAIR] DM ${dm._id} repair failed: ${dmErr.message}`);
            }
        }

        logger.info(`✅ [AUTO-REPAIR] Completed for user ${userId}: ${results.repaired} repaired, ${results.alreadyHasKey} already had keys, ${results.failed} failed; DMs repaired ${results.dms.repaired}/${results.dms.total}`);
        return results;

    } catch (error) {
        logger.error(`❌ [AUTO-REPAIR] Failed for user ${userId}:`, error);
        throw error;
    }
}

module.exports = {
    storeConversationKeys,
    getUserConversationKey,
    getUserWorkspaceConversationKeys,
    addParticipant,
    removeParticipant,
    addEncryptedKeyForUser,
    hasConversationKeys,
    distributeKeyToNewMember,
    bootstrapConversationKey,  
    generateConversationKeyServerSide,  
    repairConversationKeyForUser,
    repairUserConversationAccess,
    ensureDMConversationKey,
    isConversationMember
};
