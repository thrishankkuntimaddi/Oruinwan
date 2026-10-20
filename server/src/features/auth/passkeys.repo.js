'use strict';

// Table user_passkeys (db/migrations/0009_passkeys.sql). Plain SQL; rows come back camelCased.

const { query } = require('../../shared/postgres');
const { newId } = require('../../identity/sql');

function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    credentialId: r.credential_id,
    publicKey: r.public_key,
    counter: Number(r.counter) || 0,
    transports: r.transports || [],
    name: r.name,
    backedUp: !!r.backed_up,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  };
}

async function listForUser(userId) {
  const { rows } = await query('SELECT * FROM user_passkeys WHERE user_id = $1 ORDER BY created_at', [String(userId)]);
  return rows.map(fromRow);
}

async function findByCredentialId(credentialId) {
  const { rows } = await query('SELECT * FROM user_passkeys WHERE credential_id = $1', [String(credentialId)]);
  return fromRow(rows[0]);
}

/** Inserts a credential; returns null when that credential id is already registered. */
async function create({ userId, credentialId, publicKey, counter, transports, name, backedUp }) {
  const { rows } = await query(
    `INSERT INTO user_passkeys (id, user_id, credential_id, public_key, counter, transports, name, backed_up)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (credential_id) DO NOTHING
     RETURNING *`,
    [newId(), String(userId), String(credentialId), Buffer.from(publicKey), Number(counter) || 0,
      (transports || []).map(String), String(name), !!backedUp],
  );
  return fromRow(rows[0]);
}

async function markUsed(id, counter) {
  await query('UPDATE user_passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [String(id), Number(counter) || 0]);
}

async function rename(userId, id, name) {
  const { rows } = await query('UPDATE user_passkeys SET name = $3 WHERE id = $2 AND user_id = $1 RETURNING *',
    [String(userId), String(id), String(name)]);
  return fromRow(rows[0]);
}

async function remove(userId, id) {
  const { rowCount } = await query('DELETE FROM user_passkeys WHERE id = $2 AND user_id = $1', [String(userId), String(id)]);
  return rowCount > 0;
}

module.exports = { listForUser, findByCredentialId, create, markUsed, rename, remove };
