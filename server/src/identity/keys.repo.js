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
    async batchFindByUserIds(userIds) {
        const ids = [...new Set((userIds || []).map(str))];
        if (!ids.length) return [];
        const { rows } = await query('SELECT * FROM user_crypto_state WHERE user_id = ANY($1)', [ids]);
        return rows.map((r) => camelRow(r));
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
    /** Conversations whose key `userId` holds but the server has no copy of (older browser-made keys). */
    async listWithoutServerCopy(userId, limit = 200) {
        const { rows } = await query(
            `SELECT k.conversation_id, k.conversation_type FROM conversation_keys k
             JOIN conversation_key_members m ON m.conversation_key_id = k.id
             WHERE m.user_id = $1 AND k.workspace_encrypted_key IS NULL LIMIT $2`,
            [str(userId), limit]
        );
        return rows.map((r) => ({ conversationId: r.conversation_id, conversationType: r.conversation_type }));
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
    /** Drops every conversation key wrapped for this user (used when their identity key is replaced). */
    async removeAllMemberKeysForUser(userId) {
        const { rowCount } = await query('DELETE FROM conversation_key_members WHERE user_id = $1', [str(userId)]);
        return rowCount || 0;
    },
};

/**
 * Earlier keys of a conversation (migration 0018). The current key stays in conversation_keys;
 * rotate() moves it here (with the copies of the people who keep it) and installs a new one.
 */
const conversationKeyEpochs = {
    /** Earlier keys `userId` holds a copy of: [{ version, encryptedKey, ephemeralPublicKey, algorithm }], newest first. */
    async listForUser(conversationId, conversationType, userId) {
        const { rows } = await query(
            `SELECT em.version, em.encrypted_key, em.ephemeral_public_key, em.algorithm
               FROM conversation_key_epoch_members em
               JOIN conversation_keys k ON k.id = em.conversation_key_id
              WHERE k.conversation_id = $1 AND k.conversation_type = $2 AND em.user_id = $3
              ORDER BY em.version DESC`,
            [str(conversationId), conversationType, str(userId)]
        );
        return rows.map((r) => ({ version: r.version, encryptedKey: r.encrypted_key, ephemeralPublicKey: r.ephemeral_public_key, algorithm: r.algorithm }));
    },
    /** Every earlier key with its server copy and who holds it: [{ version, workspaceEncryptedKey, holders: Set }]. */
    async list(conversationId, conversationType) {
        const { rows } = await query(
            `SELECT e.version, e.workspace_encrypted_key, e.created_at, e.retired_at,
                    COALESCE(array_agg(em.user_id) FILTER (WHERE em.user_id IS NOT NULL), '{}') AS holders
               FROM conversation_key_epochs e
               JOIN conversation_keys k ON k.id = e.conversation_key_id
               LEFT JOIN conversation_key_epoch_members em ON em.conversation_key_id = e.conversation_key_id AND em.version = e.version
              WHERE k.conversation_id = $1 AND k.conversation_type = $2
              GROUP BY e.version, e.workspace_encrypted_key, e.created_at, e.retired_at
              ORDER BY e.version DESC`,
            [str(conversationId), conversationType]
        );
        return rows.map((r) => ({ version: r.version, workspaceEncryptedKey: r.workspace_encrypted_key, createdAt: r.created_at, retiredAt: r.retired_at, holders: new Set((r.holders || []).map(String)) }));
    },
    async addMemberKey(conversationId, conversationType, version, { userId, encryptedKey, ephemeralPublicKey = null, algorithm }) {
        await query(
            `INSERT INTO conversation_key_epoch_members (conversation_key_id, version, user_id, encrypted_key, ephemeral_public_key, algorithm)
             SELECT e.conversation_key_id, e.version, $4, $5, $6, $7
               FROM conversation_key_epochs e JOIN conversation_keys k ON k.id = e.conversation_key_id
              WHERE k.conversation_id = $1 AND k.conversation_type = $2 AND e.version = $3
             ON CONFLICT (conversation_key_id, version, user_id) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key,
                ephemeral_public_key = EXCLUDED.ephemeral_public_key, algorithm = EXCLUDED.algorithm, added_at = now()`,
            [str(conversationId), conversationType, version, str(userId), encryptedKey, ephemeralPublicKey, algorithm]
        );
    },
    /** Takes away every earlier key `userId` holds in this conversation. */
    async removeUser(conversationId, conversationType, userId) {
        await query(
            `DELETE FROM conversation_key_epoch_members
              WHERE user_id = $3 AND conversation_key_id = (SELECT id FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2)`,
            [str(conversationId), conversationType, str(userId)]
        );
    },
    /**
     * A new key, in one transaction: the current key becomes epoch `expectedVersion` (kept only by
     * `keepOld` user ids), the new key (`workspaceEncryptedKey`, member copies) becomes current at
     * expectedVersion + 1. Fails with code 'KEY_CHANGED' when the key moved on meanwhile.
     */
    async rotate(conversationId, conversationType, { expectedVersion, workspaceEncryptedKey, encryptedKeys = [], keepOld = [] }) {
        return withTransaction(async (tx) => {
            const { rows } = await tx.query(
                'SELECT * FROM conversation_keys WHERE conversation_id = $1 AND conversation_type = $2 FOR UPDATE',
                [str(conversationId), conversationType]
            );
            const key = rows[0];
            if (!key) throw Object.assign(new Error('Conversation key not found'), { code: 'NOT_FOUND' });
            if (key.version !== expectedVersion) throw Object.assign(new Error('The conversation key changed meanwhile'), { code: 'KEY_CHANGED' });
            const { rows: last } = await tx.query('SELECT max(retired_at) AS at FROM conversation_key_epochs WHERE conversation_key_id = $1', [key.id]);
            await tx.query(
                `INSERT INTO conversation_key_epochs (conversation_key_id, version, workspace_encrypted_key, created_at)
                 VALUES ($1, $2, $3, $4)`,
                [key.id, key.version, key.workspace_encrypted_key == null ? null : JSON.stringify(key.workspace_encrypted_key), last[0]?.at || key.created_at]
            );
            const keep = [...new Set(keepOld.map(str))];
            if (keep.length) {
                await tx.query(
                    `INSERT INTO conversation_key_epoch_members (conversation_key_id, version, user_id, encrypted_key, ephemeral_public_key, algorithm, added_at)
                     SELECT conversation_key_id, $2, user_id, encrypted_key, ephemeral_public_key, algorithm, added_at
                       FROM conversation_key_members WHERE conversation_key_id = $1 AND user_id = ANY($3)`,
                    [key.id, key.version, keep]
                );
            }
            await tx.query('DELETE FROM conversation_key_members WHERE conversation_key_id = $1', [key.id]);
            for (const e of encryptedKeys) {
                await tx.query(
                    `INSERT INTO conversation_key_members (conversation_key_id, user_id, encrypted_key, ephemeral_public_key, algorithm)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [key.id, str(e.userId), e.encryptedKey, e.ephemeralPublicKey || null, e.algorithm]
                );
            }
            const { rows: updated } = await tx.query(
                `UPDATE conversation_keys SET version = $2, workspace_encrypted_key = $3::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
                [key.id, key.version + 1, workspaceEncryptedKey == null ? null : JSON.stringify(workspaceEncryptedKey)]
            );
            const { rows: m } = await tx.query('SELECT * FROM conversation_key_members WHERE conversation_key_id = $1', [key.id]);
            return toConversationKey(updated[0], m);
        });
    },
};

module.exports = { identityKeys, cryptoState, conversationKeys, conversationKeyEpochs, toConversationKey };
