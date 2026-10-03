'use strict';

/**
 * E2EE key material on PostgreSQL, next to the users it belongs to:
 * identity public keys, the per-user crypto state (wrapped private key and
 * UMEK envelope) and per-conversation wrapped keys.
 */

const { query, withTransaction } = require('../shared/postgres');
const { newId, camelRow, str } = require('./sql');

const identityKeys = {
    async findByUserId(userId) {
        const { rows } = await query('SELECT * FROM user_identity_keys WHERE user_id = $1', [str(userId)]);
        return camelRow(rows[0]);
    },
    async batchFindByUserIds(userIds) {
        const ids = [...new Set((userIds || []).map(str))];
        if (!ids.length) return [];
        const { rows } = await query('SELECT * FROM user_identity_keys WHERE user_id = ANY($1)', [ids]);
        return rows.map((r) => camelRow(r));
    },
    async upsert(userId, { publicKey, algorithm, version = 1 }) {
        const { rows } = await query(
            `INSERT INTO user_identity_keys (user_id, public_key, algorithm, version) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE SET public_key = EXCLUDED.public_key, algorithm = EXCLUDED.algorithm, version = EXCLUDED.version, updated_at = now()
             RETURNING *`,
            [str(userId), publicKey, algorithm, version]
        );
        return camelRow(rows[0]);
    },
    async remove(userId) { await query('DELETE FROM user_identity_keys WHERE user_id = $1', [str(userId)]); },
};

const CRYPTO_COLS = {
    identityPublicKey: 'identity_public_key', encryptedIdentityPrivateKey: 'encrypted_identity_private_key',
    identityPrivateKeyIv: 'identity_private_key_iv', umekEnvelope: 'umek_envelope', umekEnvelopeIv: 'umek_envelope_iv',
    umekSalt: 'umek_salt', umekProtectionType: 'umek_protection_type', algorithm: 'algorithm', kekVersion: 'kek_version', version: 'version',
};

const cryptoState = {
    async findByUserId(userId) {
        const { rows } = await query('SELECT * FROM user_crypto_state WHERE user_id = $1', [str(userId)]);
        return camelRow(rows[0]);
    },
    async upsert(userId, state) {
        const cols = ['user_id'];
        const params = [str(userId)];
        for (const [k, col] of Object.entries(CRYPTO_COLS)) {
            if (state[k] === undefined) continue;
            cols.push(col);
            params.push(state[k]);
        }
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const updates = cols.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ');
        const { rows } = await query(
            `INSERT INTO user_crypto_state (${cols.join(', ')}) VALUES (${placeholders})
             ON CONFLICT (user_id) DO UPDATE SET ${updates || 'version = user_crypto_state.version'}, updated_at = now() RETURNING *`,
            params
        );
        return camelRow(rows[0]);
    },
    async remove(userId) { await query('DELETE FROM user_crypto_state WHERE user_id = $1', [str(userId)]); },
};

function toConversationKey(row, memberRows = []) {
    const k = camelRow(row);
    if (!k) return null;
    k.encryptedKeys = memberRows.map((m) => ({ userId: m.user_id, encryptedKey: m.encrypted_key, ephemeralPublicKey: m.ephemeral_public_key, algorithm: m.algorithm, addedAt: m.added_at }));
    k.hasAccess = (userId) => k.encryptedKeys.some((e) => e.userId === str(userId));
    k.getEncryptedKeyForUser = (userId) => k.encryptedKeys.find((e) => e.userId === str(userId)) || null;
    return k;
}

async function hydrate(rows) {
    if (!rows.length) return [];
    const { rows: m } = await query('SELECT * FROM conversation_key_members WHERE conversation_key_id = ANY($1)', [rows.map((r) => r.id)]);
    const by = new Map();
    for (const r of m) { if (!by.has(r.conversation_key_id)) by.set(r.conversation_key_id, []); by.get(r.conversation_key_id).push(r); }
    return rows.map((r) => toConversationKey(r, by.get(r.id) || []));
}

const conversationKeys = {
    async findByConversation(conversationId, conversationType) {
        const { rows } = await query('SELECT * FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2', [str(conversationId), conversationType]);
        return rows[0] ? (await hydrate(rows))[0] : null;
    },
    async findByUser(userId, workspaceId) {
        const params = [str(userId)];
        let where = 'm.user_id = $1';
        if (workspaceId) { params.push(str(workspaceId)); where += ' AND k.workspace_id = $2'; }
        const { rows } = await query(`SELECT DISTINCT k.* FROM conversation_keys k JOIN conversation_key_members m ON m.conversation_key_id = k.id WHERE ${where}`, params);
        return hydrate(rows);
    },
    async listForWorkspace(workspaceId) {
        const { rows } = await query('SELECT * FROM conversation_keys WHERE workspace_id = $1', [str(workspaceId)]);
        return hydrate(rows);
    },
    /** Create or replace the key record and its member envelopes in one transaction. */
    async upsert({ conversationId, conversationType, workspaceId, workspaceEncryptedKey = null, version = 1, encryptedKeys = [] }) {
        return withTransaction(async (tx) => {
            const { rows } = await tx.query(
                `INSERT INTO conversation_keys (id, conversation_id, conversation_type, workspace_id, workspace_encrypted_key, version)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6)
                 ON CONFLICT (conversation_id, conversation_type) DO UPDATE SET workspace_id = EXCLUDED.workspace_id,
                    workspace_encrypted_key = COALESCE(EXCLUDED.workspace_encrypted_key, conversation_keys.workspace_encrypted_key),
                    version = EXCLUDED.version, updated_at = now()
                 RETURNING *`,
                [newId(), str(conversationId), conversationType, str(workspaceId), workspaceEncryptedKey == null ? null : JSON.stringify(workspaceEncryptedKey), version]
            );
            const key = rows[0];
            for (const e of encryptedKeys) {
                await tx.query(
                    `INSERT INTO conversation_key_members (conversation_key_id, user_id, encrypted_key, ephemeral_public_key, algorithm)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (conversation_key_id, user_id) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, ephemeral_public_key = EXCLUDED.ephemeral_public_key, algorithm = EXCLUDED.algorithm, added_at = now()`,
                    [key.id, str(e.userId), e.encryptedKey, e.ephemeralPublicKey || null, e.algorithm]
                );
            }
            const { rows: m } = await tx.query('SELECT * FROM conversation_key_members WHERE conversation_key_id = $1', [key.id]);
            return toConversationKey(key, m);
        });
    },
    async addMemberKey(conversationId, conversationType, { userId, encryptedKey, ephemeralPublicKey = null, algorithm }) {
        const { rows } = await query('SELECT id FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2', [str(conversationId), conversationType]);
        if (!rows[0]) return null;
        await query(
            `INSERT INTO conversation_key_members (conversation_key_id, user_id, encrypted_key, ephemeral_public_key, algorithm) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (conversation_key_id, user_id) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, ephemeral_public_key = EXCLUDED.ephemeral_public_key, algorithm = EXCLUDED.algorithm, added_at = now()`,
            [rows[0].id, str(userId), encryptedKey, ephemeralPublicKey, algorithm]
        );
        return conversationKeys.findByConversation(conversationId, conversationType);
    },
    async removeMemberKey(conversationId, conversationType, userId) {
        await query(
            `DELETE FROM conversation_key_members WHERE user_id = $3 AND conversation_key_id = (SELECT id FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2)`,
            [str(conversationId), conversationType, str(userId)]
        );
    },
    async remove(conversationId, conversationType) {
        await query('DELETE FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2', [str(conversationId), conversationType]);
    },
};

module.exports = { identityKeys, cryptoState, conversationKeys, toConversationKey };
