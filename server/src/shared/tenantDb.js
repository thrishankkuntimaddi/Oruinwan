'use strict';

/**
 * Stage 3: dedicated databases for large tenants, without touching the rest.
 *
 *   TENANT_DB_MAP={"<companyId>":"mongodb+srv://.../acme", ...}
 *
 * `modelFor(Model, companyId)` returns the same schema bound to that company's
 * connection, or the default model when the company has no entry. Code paths
 * that know the tenant (everything under /api/companies, workspace routes,
 * messaging) can opt in one at a time:
 *
 *   const Message = modelFor(require('../modules/messages/message.model'), req.companyId);
 *
 * Connections open lazily and are shared per URI. Cross-tenant queries
 * (platform admin reports) keep using the default connection, so a company on
 * its own database is invisible there until a report is taught to fan out.
 */

const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { connectionOptions } = require('./db');

let map = null;
const connections = new Map(); // uri -> mongoose.Connection

function tenantMap(env = process.env) {
    if (map && env === process.env) return map;
    let parsed = {};
    if (env.TENANT_DB_MAP) {
        try {
            parsed = JSON.parse(env.TENANT_DB_MAP);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be an object');
        } catch (err) {
            logger.error(`[TENANT_DB] TENANT_DB_MAP ignored: ${err.message}`);
            parsed = {};
        }
    }
    if (env === process.env) map = parsed;
    return parsed;
}

function tenantUri(companyId, env = process.env) {
    if (!companyId) return null;
    return tenantMap(env)[String(companyId)] || null;
}

function connectionFor(uri, env = process.env) {
    if (!connections.has(uri)) {
        const conn = mongoose.createConnection(uri, connectionOptions(env));
        conn.on('error', (err) => logger.error(`[TENANT_DB] connection error: ${err.message}`));
        connections.set(uri, conn);
        logger.info('[TENANT_DB] opened a dedicated tenant connection');
    }
    return connections.get(uri);
}

/**
 * The model to use for this company: a per-tenant binding of the same schema
 * when TENANT_DB_MAP routes the company elsewhere, else the model itself.
 */
function modelFor(Model, companyId, env = process.env) {
    const uri = tenantUri(companyId, env);
    if (!uri) return Model;
    const conn = connectionFor(uri, env);
    return conn.models[Model.modelName] || conn.model(Model.modelName, Model.schema, Model.collection.collectionName);
}

function hasDedicatedDatabase(companyId, env = process.env) {
    return !!tenantUri(companyId, env);
}

async function closeTenantConnections() {
    const all = [...connections.values()];
    connections.clear();
    await Promise.all(all.map((c) => c.close().catch(() => {})));
}

/** Test hook. */
function _reset() { map = null; connections.clear(); }

module.exports = { modelFor, tenantUri, tenantMap, hasDedicatedDatabase, closeTenantConnections, _reset };
