'use strict';

/**
 * Small helpers shared by the identity repositories: id generation, column
 * maps, UPDATE builders and row → object mapping. Plain SQL, no ORM.
 *
 * Ids are 24-hex strings (the same shape MongoDB used) so documents that still
 * live in MongoDB and reference a user or workspace by id keep working.
 */

const mongoose = require('mongoose');

function newId() {
    return new mongoose.Types.ObjectId().toString();
}

// companies.phone is jsonb ({ ownerPhone, verified, otp, ... }) while users.phone is text; a plain
// object value decides which (see isJsonValue).
const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
    && typeof v.toHexString !== 'function' && Object.getPrototypeOf(v) === Object.prototype;
const isJsonValue = (col, value) => isJsonColumn(col) || (col === 'phone' && isPlainObject(value));

const isJsonColumn = (col) => /^(profile|preferences|permissions|settings|limits|documents|sso|security_settings|phone_json|invite_policy|metadata|social|device_tokens|legal_hold|suspension|password_flags|login_guard|tokens|encryption|roles_per_company|work_history|analytics_cache|channel_permissions|feature_toggles|custom_permissions|domain_verification|meta|workspace_encrypted_key)$/.test(col);

/**
 * Build `SET col = $n, ...` from a patch object using a camelCase → column map.
 * Unknown keys are ignored (callers log them). jsonb columns are stored as
 * JSON text; `{ $merge: true }` on a jsonb value merges instead of replacing.
 */
function buildUpdate(patch, columnMap, { startAt = 1 } = {}) {
    const sets = [];
    const params = [];
    let n = startAt;
    for (const [key, value] of Object.entries(patch || {})) {
        const col = columnMap[key];
        if (!col || value === undefined) continue;
        if (isJsonValue(col, value) && value && typeof value === 'object' && value.$merge) {
            const { $merge, ...rest } = value;
            sets.push(`${col} = COALESCE(${col}, '{}'::jsonb) || $${n}::jsonb`);
            params.push(JSON.stringify(rest));
        } else if (isJsonValue(col, value)) {
            sets.push(`${col} = $${n}::jsonb`);
            params.push(value === null ? null : JSON.stringify(value));
        } else if (Array.isArray(value)) {
            sets.push(`${col} = $${n}`);
            params.push(value.map(String));
        } else {
            sets.push(`${col} = $${n}`);
            params.push(value instanceof Date || value === null ? value : (typeof value === 'object' ? String(value) : value));
        }
        n += 1;
    }
    return { sets, params, next: n };
}

/** Pick listed camelCase keys off an object into column values, for INSERTs. */
function columnsFor(obj, columnMap) {
    const cols = [];
    const params = [];
    for (const [key, col] of Object.entries(columnMap)) {
        if (obj[key] === undefined) continue;
        cols.push(col);
        const v = obj[key];
        if (isJsonValue(col, v)) params.push(v === null ? null : JSON.stringify(v));
        else if (Array.isArray(v)) params.push(v.map(String));
        else if (v instanceof Date || v === null || typeof v !== 'object') params.push(v);
        else params.push(String(v));
    }
    return { cols, params };
}

function insertSql(table, cols) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
}

/** snake_case row → camelCase object; `_id` mirrors `id` for code written against Mongo shapes. */
function camelRow(row, overrides = {}) {
    if (!row) return null;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        out[key] = v;
    }
    if (out.id !== undefined) out._id = out.id;
    return Object.assign(out, overrides);
}

const str = (v) => (v == null ? null : String(v._id || v));

module.exports = { newId, buildUpdate, columnsFor, insertSql, camelRow, str, isJsonColumn, isJsonValue };
