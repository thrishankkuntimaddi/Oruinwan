'use strict';

/**
 * Dual-write of the append-only logs into PostgreSQL (migration 0002_logs).
 *
 * This release every audit, compliance and security document saved in MongoDB
 * is mirrored here through a post-save hook on the three models, so the 17
 * call sites stay untouched. Reads still come from MongoDB. The next release
 * flips reads to PostgreSQL and the Mongo models go away.
 *
 * LOG_STORE=mongo turns the mirror off (default: both when DATABASE_URL is set).
 */

const logger = require('../../utils/logger');
const { isPostgresEnabled, query } = require('./postgres');

const str = (v) => (v == null ? null : String(v));
const json = (v) => (v == null ? null : JSON.stringify(v));

function mirrorEnabled(env = process.env) {
    return isPostgresEnabled(env) && env.LOG_STORE !== 'mongo';
}

async function writeAudit(d) {
    await query(
        `INSERT INTO audit_log (company_id, user_id, action, resource, resource_id, details, description,
            ip_address, user_agent, endpoint, method, status, error_message, severity, category, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [str(d.companyId), str(d.userId), d.action, d.resource || null, str(d.resourceId), json(d.details), d.description || null,
            d.ipAddress || null, d.userAgent || null, d.endpoint || null, d.method || null, d.status || 'success', d.errorMessage || null,
            d.severity || 'info', d.category || 'system', d.createdAt || new Date()]
    );
}

async function writeCompliance(d) {
    await query(
        `INSERT INTO compliance_log (company_id, actor_id, actor_email, actor_role, action, category, severity,
            resource_type, resource_id, resource_name, details, ip_address, user_agent, hash, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [str(d.companyId), str(d.actorId), d.actorEmail || null, d.actorRole || null, d.action, d.category, d.severity || 'info',
            d.resourceType || null, str(d.resourceId), d.resourceName || null, json(d.details), d.ipAddress || null, d.userAgent || null,
            d.hash || null, d.createdAt || new Date()]
    );
}

async function writeSecurityEvent(d) {
    await query(
        `INSERT INTO security_event (company_id, actor_id, event_type, severity, outcome, ip_address, user_agent, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [str(d.companyId), str(d.actorId), d.eventType, d.severity || 'info', d.outcome || 'success', d.ipAddress || null,
            d.userAgent || null, json(d.metadata || {}), d.createdAt || new Date()]
    );
}

const WRITERS = { audit: writeAudit, compliance: writeCompliance, security: writeSecurityEvent };

/**
 * Mongoose plugin: after a document is saved, mirror it. Never throws and
 * never delays the caller.
 *   AuditLogSchema.plugin(mirrorToPostgres, { kind: 'audit' })
 */
function mirrorToPostgres(schema, { kind }) {
    const write = WRITERS[kind];
    if (!write) throw new Error(`logStore: unknown kind ${kind}`);
    schema.post('save', function mirror(doc) {
        if (!mirrorEnabled()) return;
        const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
        write(plain).catch((err) => logger.warn(`[LOG_STORE] ${kind} mirror failed: ${err.message}`));
    });
}

module.exports = { mirrorToPostgres, mirrorEnabled, writeAudit, writeCompliance, writeSecurityEvent };
