'use strict';

/**
 * Retention for the collections that only ever grow: audit, history, activity
 * and security-audit logs. Each one gets a MongoDB TTL index named
 * `retention_ttl` when its *_RETENTION_DAYS variable is above zero; at zero
 * (the default) nothing is deleted and any earlier retention_ttl index is
 * removed. Changing the number updates the index in place (collMod).
 *
 * Only indexes named `retention_ttl` are touched, so schema-defined TTLs
 * (security events, AI usage, notifications) stay as they are.
 *
 * Suggested production values: HISTORY_LOG_RETENTION_DAYS=365,
 * ACTIVITY_RETENTION_DAYS=180, SECURITY_AUDIT_RETENTION_DAYS=365; keep
 * AUDIT_LOG_RETENTION_DAYS at 0 unless your compliance policy allows it.
 */

const logger = require('../../utils/logger');

const INDEX_NAME = 'retention_ttl';

const POLICIES = [
    { name: 'AuditLog', env: 'AUDIT_LOG_RETENTION_DAYS', field: 'createdAt', model: () => require('../../models/AuditLog') },
    { name: 'HistoryLog', env: 'HISTORY_LOG_RETENTION_DAYS', field: 'timestamp', model: () => require('../../models/HistoryLog') },
    { name: 'ActivityEvent', env: 'ACTIVITY_RETENTION_DAYS', field: 'createdAt', model: () => require('../models/ActivityEvent') },
    { name: 'SecurityAuditEvent', env: 'SECURITY_AUDIT_RETENTION_DAYS', field: 'createdAt', model: () => require('../models/SecurityAuditEvent') },
];

function daysFromEnv(env, key) {
    const n = Number(env[key]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Create, update or drop one collection's retention_ttl index. Returns what was done. */
async function applyPolicy(collection, field, days) {
    const seconds = days * 24 * 60 * 60;
    let existing = null;
    try {
        existing = (await collection.indexes()).find((ix) => ix.name === INDEX_NAME) || null;
    } catch (err) {
        if (err.codeName !== 'NamespaceNotFound' && err.code !== 26) throw err;
    }

    if (days === 0) {
        if (!existing) return 'none';
        await collection.dropIndex(INDEX_NAME);
        return 'dropped';
    }
    if (!existing) {
        await collection.createIndex({ [field]: 1 }, { name: INDEX_NAME, expireAfterSeconds: seconds, background: true });
        return 'created';
    }
    if (existing.expireAfterSeconds === seconds) return 'unchanged';
    await collection.db.command({ collMod: collection.collectionName, index: { name: INDEX_NAME, expireAfterSeconds: seconds } });
    return 'updated';
}

/** Apply every policy; never throws (a failing policy is logged and skipped). */
async function applyRetentionPolicies(env = process.env) {
    const results = {};
    for (const policy of POLICIES) {
        const days = daysFromEnv(env, policy.env);
        try {
            const Model = policy.model();
            const action = await applyPolicy(Model.collection, policy.field, days);
            results[policy.name] = { days, action };
            if (action !== 'none' && action !== 'unchanged') {
                logger.info(`[RETENTION] ${policy.name}: ${action} TTL index (${days ? `${days} days` : 'keep forever'})`);
            }
        } catch (err) {
            results[policy.name] = { days, error: err.message };
            logger.warn(`[RETENTION] ${policy.name}: could not apply retention (${err.message})`);
        }
    }
    return results;
}

module.exports = { applyRetentionPolicies, applyPolicy, daysFromEnv, POLICIES, INDEX_NAME };
