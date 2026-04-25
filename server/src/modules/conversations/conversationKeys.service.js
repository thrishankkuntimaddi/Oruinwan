const crypto = require('crypto');
const ConversationKey = require('../../../models/ConversationKey');
const UserIdentityKey = require('../../../models/UserIdentityKey');
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

        const conversationKey = session
            ? (await ConversationKey.create([createOptions], { session }))[0]
            : await ConversationKey.create(createOptions);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔐 [PHASE 3] Conversation key stored for ${conversationType}:${conversationId}`);
        console.log(`📥 [PHASE 3] Members encrypted: ${encryptedKeys.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return conversationKey;
    } catch (error) {
        console.error('Failed to store conversation keys:', error);
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
            
            console.log(`User ${userId} does not have access to ${conversationType}:${conversationId}`);
            return null;
        }

        
        const encryptedKeyData = conversationKey.getEncryptedKeyForUser(userId);

        if (!encryptedKeyData) {
            console.log(`No encrypted key found for user ${userId} in ${conversationType}:${conversationId}`);
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
        console.error('Failed to get user conversation key:', error);
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
        console.error('Failed to get user workspace conversation keys:', error);
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
            console.log(`User ${userId} already has access to ${conversationType}:${conversationId}`);
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

        console.log(`✅ Added participant ${userId} to ${conversationType}:${conversationId}`);
        return conversationKey;
    } catch (error) {
        console.error('Failed to add participant:', error);
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
            console.log(`User ${userId} not found in ${conversationType}:${conversationId}`);
            return false;
        }

        await conversationKey.save();

        console.log(`🗑️ Removed participant ${userId} from ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        console.error('Failed to remove participant:', error);
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
            console.log(`User ${userId} already has access to ${conversationType}:${conversationId}`);
            return true;
        }

        
        conversationKey.encryptedKeys.push({
            userId,
            encryptedKey,
            ephemeralPublicKey: ephemeralPublicKey || undefined,
            algorithm
        });

        await conversationKey.save();

        console.log(`✅ Added encrypted key for user ${userId} in ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        console.error('Failed to add encrypted key for user:', error);
        throw error;
    }
}

async function distributeKeyToNewMember(conversationId, conversationType, newUserId) {
    try {
        console.log(`🔐 [Server Distribution] Distributing key for ${conversationType}:${conversationId} to user ${newUserId}`);

        
        
        
        console.log(`🔗 [AUDIT][PHASE1][DISTRIBUTE] Key distribution request received`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ Target user: ${newUserId}`);
        console.log(`   └─ Timestamp: ${new Date().toISOString()}`);

        
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            console.error(`❌ [Server Distribution] No conversation key found for ${conversationType}:${conversationId}`);
            
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] CRITICAL: No conversation key exists`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Target user: ${newUserId}`);
            console.error(`   ├─ Reason: ConversationKey document NOT FOUND in database`);
            console.error(`   └─ This channel was NEVER encrypted (Phase 5 failed or skipped)`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        if (conversationKey.hasAccess(newUserId)) {
            console.log(`ℹ️ [PHASE 4] User ${newUserId} already has conversation key`);
            
            console.log(`✅ [AUDIT][PHASE1][DISTRIBUTE] User already has key (idempotent)`);
            console.log(`   ├─ User: ${newUserId}`);
            console.log(`   └─ Already in encryptedKeys[] - no action needed`);
            return true;
        }

        
        let conversationKeyBytes;

        if (!conversationKey.workspaceEncryptedKey) {
            console.warn(`⚠️ [PHASE 4] Legacy conversation key detected (not workspace-wrapped) for ${conversationType}:${conversationId}`);

            
            
            
            
            console.error(`❌ [PHASE 4] Cannot distribute legacy unwrapped key - requires client-side re-sharing`);
            console.error(`   Solution: Original member must re-encrypt key for new member via client`);

            
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`⚠️ [AUDIT][PHASE1][DISTRIBUTE] LEGACY KEY DETECTED`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Target user: ${newUserId}`);
            console.error(`   ├─ Missing: workspaceEncryptedKey field`);
            console.error(`   ├─ Reason: Channel created BEFORE workspace wrapping was enforced`);
            console.error(`   ├─ Server cannot decrypt: Needs user's private key`);
            console.error(`   └─ Solution: Client-side key re-sharing required`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        const newUserKeyDoc = await UserIdentityKey.findByUserId(newUserId);

        if (!newUserKeyDoc || !newUserKeyDoc.publicKey) {
            console.error(`❌ [Server Distribution] User ${newUserId} has no E2EE public key`);
            
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] User has no E2EE public key`);
            console.error(`   ├─ User: ${newUserId}`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Reason: UserIdentityKey NOT FOUND or publicKey missing`);
            console.error(`   └─ Cannot encrypt key for this user`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }

        
        console.log(`🔓 [Server Distribution] Unwrapping conversation key with SERVER_KEK...`);
        conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
            conversationKey.workspaceEncryptedKey,
            conversationKey.workspaceKeyIv,
            conversationKey.workspaceKeyAuthTag
        );

        
        console.log(`🔐 [Server Distribution] Re-encrypting for user ${newUserId}...`);
        const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, newUserKeyDoc.publicKey);

        
        conversationKey.encryptedKeys.push({
            userId: newUserId,
            encryptedKey: wrapped.encryptedKey,
            algorithm: wrapped.algorithm
        });

        await conversationKey.save();

        console.log(`✅ [PHASE 4] Distributed conversation key for ${conversationType}:${conversationId} to user ${newUserId}`);

        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ [AUDIT][PHASE1][DISTRIBUTE] Key distribution SUCCESS`);
        console.log(`   ├─ User: ${newUserId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        console.log(`   ├─ User added to encryptedKeys[] array`);
        console.log(`   └─ INV-001 gap closed for this user`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return true;

    } catch (error) {
        console.error(`❌ [Server Distribution] Failed to distribute key:`, error);
        
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] Distribution EXCEPTION`);
        console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.error(`   ├─ Target user: ${newUserId}`);
        console.error(`   ├─ Error message: ${error.message}`);
        console.error(`   ├─ Error stack: ${error.stack}`);
        console.error(`   └─ Returning false (distribution failed)`);
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return false;
    }

}

async function hasConversationKeys(conversationId, conversationType) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);
        return conversationKey !== null;
    } catch (error) {
        console.error('Failed to check conversation keys:', error);
        return false;
    }
}

async function bootstrapConversationKey({ conversationId, conversationType, workspaceId, members }) {
    try {
        console.log(`🔐 [Bootstrap] Creating conversation key for ${conversationType}:${conversationId}`);

        
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);
        if (existing) {
            console.log(`✅ Conversation key already exists for ${conversationType}:${conversationId}`);
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
                console.warn(`⚠️ User ${userId} has no E2EE public key, skipping`);
                continue;
            }

            
            const wrapped = cryptoUtils.wrapForUser(conversationKey, keyDoc.publicKey);
            encryptedKeys.push({
                userId: userId.toString(),
                encryptedKey: wrapped.encryptedKey,
                algorithm: wrapped.algorithm
            });
        }

        
        
        
        if (encryptedKeys.length === 0) {
            console.warn(`⚠️ [Bootstrap] No users with E2EE keys found for ${conversationType}:${conversationId}`);
            console.warn(`   Creating conversation key with workspace wrapping only`);
            console.warn(`   User-specific keys will be distributed when users upload public keys`);
        }

        
        
        
        const conversationKeyDoc = await ConversationKey.create({
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

        console.log(`✅ [Bootstrap] Conversation key created for ${conversationType}:${conversationId} (${encryptedKeys.length} users)`);
        return conversationKeyDoc;

    } catch (error) {
        console.error(`❌ [Bootstrap] Failed to create conversation key:`, error);
        throw error;
    }
}

async function generateConversationKeyServerSide(conversationId, conversationType, workspaceId, members, creatorId, session = null) {
    try {
        
        
        
        console.log(`🔐 [PHASE 5] Generating conversation key at channel birth for ${conversationId}`);
        console.log(`📊 [AUDIT][PHASE1][CREATION] Channel key generation starting`);
        console.log(`   ├─ Channel ID: ${conversationId}`);
        console.log(`   ├─ Conversation Type: ${conversationType}`);
        console.log(`   ├─ Workspace ID: ${workspaceId}`);
        console.log(`   ├─ Total members: ${members.length}`);
        console.log(`   ├─ Members list: ${JSON.stringify(members)}`);
        console.log(`   ├─ Creator ID: ${creatorId}`);
        console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        
        const conversationKeyBytes = crypto.randomBytes(32);
        console.log(`✅ [PHASE 5] Generated random AES-256 conversation key`);

        
        const workspaceWrapped = cryptoUtils.encryptWithWorkspaceKey(conversationKeyBytes, workspaceId);
        console.log(`✅ [PHASE 5] Wrapped conversation key with workspace key`);

        
        const identityKeys = await UserIdentityKey.batchFindByUserIds(members);

        
        const publicKeyMap = new Map();
        identityKeys.forEach(k => publicKeyMap.set(k.userId.toString(), k));

        
        const encryptedKeys = [];
        let creatorHasKey = false;

        
        const skippedMembers = [];

        for (const userId of members) {
            const keyDoc = publicKeyMap.get(userId.toString());

            if (!keyDoc || !keyDoc.publicKey) {
                console.warn(`⚠️ [PHASE 5] User ${userId} has no E2EE public key, skipping`);
                
                skippedMembers.push({ userId: userId.toString(), reason: 'MISSING_PUBLIC_KEY' });
                continue;
            }

            
            const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, keyDoc.publicKey);
            encryptedKeys.push({
                userId: userId.toString(),
                encryptedKey: wrapped.encryptedKey,
                algorithm: wrapped.algorithm
            });

            console.log(`✅ [PHASE 5] Encrypted conversation key for user ${userId}`);

            
            if (userId.toString() === creatorId.toString()) {
                creatorHasKey = true;
            }
        }

        
        
        
        if (!creatorHasKey) {
            console.warn(`⚠️ [PHASE 5] Creator ${creatorId} has no E2EE key - channel will be encrypted when identity is available`);
            console.warn(`   Channel created with workspace wrapping only`);
            console.warn(`   Keys will be distributed via automatic repair when creator's identity is uploaded`);
            console.warn(`   ⚠️ INVARIANT: Channel will be READ-ONLY until repair completes (enforced by client-side guards)`);
            
        }

        
        if (encryptedKeys.length < members.length) {
            console.warn(`⚠️ [PHASE 5] ${members.length - encryptedKeys.length} members without E2EE keys will not have access`);
        }

        
        
        
        const coveragePercent = Math.round((encryptedKeys.length / members.length) * 100);
        console.log(`📊 [AUDIT][PHASE1][CREATION] Key generation complete`);
        console.log(`   ├─ Channel ID: ${conversationId}`);
        console.log(`   ├─ Total members in channel.members: ${members.length}`);
        console.log(`   ├─ Keys generated in encryptedKeys[]: ${encryptedKeys.length}`);
        console.log(`   ├─ Coverage: ${coveragePercent}% (${encryptedKeys.length}/${members.length})`);

        if (skippedMembers.length > 0) {
            console.warn(`   ├─ ⚠️ INVARIANT VIOLATION DETECTED`);
            console.warn(`   ├─ INV-001 broken: ${skippedMembers.length} members WITHOUT keys`);
            console.warn(`   ├─ Skipped members: ${JSON.stringify(skippedMembers)}`);
            console.warn(`   └─ These users are IN channel.members but NOT IN encryptedKeys[]`);
        } else {
            console.log(`   └─ ✅ INV-001 satisfied: All members have keys`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        
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

        console.log(`✅ [PHASE 5] Conversation key created and stored at channel birth for ${conversationId} (${encryptedKeys.length} users)`);
        return true;

    } catch (error) {
        console.error(`❌ [PHASE 5] Failed to generate conversation key:`, error);
        throw error;
    }
}

async function repairConversationKeyForUser(channelId, userId) {
    const Channel = require("../../features/channels/channel.model.js");

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 [PHASE2][REPAIR] Repair request received`);
    console.log(`   ├─ Channel: ${channelId}`);
    console.log(`   ├─ User: ${userId}`);
    console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        
        
        
        console.log(`🔍 [PHASE2][REPAIR][GATE-1] Checking conversation key existence...`);

        const conversationKey = await ConversationKey.findOne({
            conversationId: channelId,
            conversationType: 'channel'
        });

        if (!conversationKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: No conversation key found`);
            console.error(`   ├─ Channel was never encrypted (Phase 5 failure)`);
            console.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Conversation key document does not exist'
            };
        }

        if (!conversationKey.workspaceEncryptedKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: Legacy key (no workspace wrapping)`);
            console.error(`   ├─ Channel has legacy key without SERVER_KEK wrapping`);
            console.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Legacy key without workspace wrapping'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-1] PASSED ✓`);
        console.log(`   ├─ Conversation key exists: YES`);
        console.log(`   └─ Workspace-wrapped: YES`);

        
        
        
        console.log(`🔍 [PHASE2][REPAIR][GATE-2] Checking channel membership...`);

        const channel = await Channel.findById(channelId).select('members');

        if (!channel) {
            console.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: Channel not found`);
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
            console.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: User not in channel.members[]`);
            console.error(`   ├─ User: ${userId}`);
            console.error(`   ├─ Channel: ${channelId}`);
            console.error(`   └─ Result: CANNOT_REPAIR_NOT_A_MEMBER`);
            return {
                result: 'CANNOT_REPAIR_NOT_A_MEMBER',
                reason: 'User is not a member of this channel'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-2] PASSED ✓`);
        console.log(`   └─ User is in channel.members[]: YES`);

        
        
        
        console.log(`🔍 [PHASE2][REPAIR][GATE-3] Checking if user already has key...`);

        const userHasKey = conversationKey.encryptedKeys.some(ek =>
            ek.userId.toString() === userId.toString()
        );

        if (userHasKey) {
            console.log(`ℹ️ [PHASE2][REPAIR][GATE-3] User already has key (idempotent)`);
            console.log(`   ├─ User: ${userId}`);
            console.log(`   ├─ Already in encryptedKeys[]: YES`);
            console.log(`   └─ Result: NO_REPAIR_NEEDED`);
            return {
                result: 'NO_REPAIR_NEEDED',
                reason: 'User already has encryption key'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-3] PASSED ✓`);
        console.log(`   ├─ User in encryptedKeys[]: NO`);
        console.log(`   └─ INV-001 violation confirmed - repair needed`);

        
        
        
        console.log(`🔍 [PHASE2][REPAIR][GATE-4] Checking user's E2EE public key...`);

        const userIdentityKey = await UserIdentityKey.findByUserId(userId);

        if (!userIdentityKey || !userIdentityKey.publicKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-4] FAILED: User has no E2EE public key`);
            console.error(`   ├─ User: ${userId}`);
            console.error(`   ├─ UserIdentityKey exists: ${!!userIdentityKey}`);
            console.error(`   ├─ Public key exists: NO`);
            console.error(`   └─ Result: CANNOT_REPAIR_MISSING_PUBLIC_KEY`);
            return {
                result: 'CANNOT_REPAIR_MISSING_PUBLIC_KEY',
                reason: 'User has no E2EE identity key'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-4] PASSED ✓`);
        console.log(`   ├─ User has E2EE public key: YES`);
        console.log(`   └─ Algorithm: ${userIdentityKey.algorithm}`);

        
        
        
        console.log(`🔍 [PHASE2][REPAIR][GATE-5] Unwrapping conversation key with SERVER_KEK...`);

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
            console.error(`❌ [PHASE2][REPAIR][GATE-5] FAILED: Cannot unwrap conversation key`);
            console.error(`   ├─ Error: ${unwrapError.message}`);
            console.error(`   ├─ Channel: ${channelId}`);
            console.error(`   └─ Result: CANNOT_REPAIR_UNWRAP_FAILED`);
            return {
                result: 'CANNOT_REPAIR_UNWRAP_FAILED',
                reason: `Unwrap failed: ${unwrapError.message}`
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-5] PASSED ✓`);
        console.log(`   ├─ Conversation key unwrapped successfully`);
        console.log(`   └─ Key size: 32 bytes (AES-256)`);

        
        
        
        console.log(`🔧 [PHASE2][REPAIR] ALL GATES PASSED - Proceeding with repair`);
        console.log(`   ├─ User: ${userId}`);
        console.log(`   └─ Channel: ${channelId}`);

        
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

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ [PHASE2][REPAIR] REPAIR SUCCESS`);
        console.log(`   ├─ User: ${userId}`);
        console.log(`   ├─ Channel: ${channelId}`);
        console.log(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        console.log(`   ├─ Added to encryptedKeys[]: YES`);
        console.log(`   ├─ INV-001 violation REPAIRED`);
        console.log(`   └─ User can now: Fetch key, decrypt messages, send messages`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'REPAIR_SUCCESS',
            userId: userId,
            channelId: channelId,
            algorithm: wrapped.algorithm
        };

    } catch (error) {
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error(`❌ [PHASE2][REPAIR] EXCEPTION during repair`);
        console.error(`   ├─ User: ${userId}`);
        console.error(`   ├─ Channel: ${channelId}`);
        console.error(`   ├─ Error: ${error.message}`);
        console.error(`   └─ Stack: ${error.stack}`);
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'CANNOT_REPAIR_EXCEPTION',
            reason: error.message,
            error: error.message
        };
    }

}

async function repairUserConversationAccess(userId) {
    console.log(`🔧 [AUTO-REPAIR] Starting automatic repair for user ${userId}...`);

    const Channel = require("../../features/channels/channel.model.js");

    try {
        
        const userChannels = await Channel.find({
            'members.user': userId
        }).select('_id name workspace');

        console.log(`📊 [AUTO-REPAIR] Found ${userChannels.length} channels for user ${userId}`);

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

        console.log(`✅ [AUTO-REPAIR] Completed for user ${userId}: ${results.repaired} repaired, ${results.alreadyHasKey} already had keys, ${results.failed} failed`);
        return results;

    } catch (error) {
        console.error(`❌ [AUTO-REPAIR] Failed for user ${userId}:`, error);
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
    repairUserConversationAccess  
};
