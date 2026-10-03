'use strict';

/**
 * PostgreSQL for the relational side of Oruinwan (identity, tasks, billing,
 * audit, embeddings). One pool per process, plain SQL through `pg`, no ORM.
 *
 *   DATABASE_URL        postgres://user:pass@host:5432/oruinwan   (unset = PostgreSQL features off)
 *   PG_POOL_SIZE        max connections per process (default 10)
 *   PG_AUTO_MIGRATE     "false" to stop boot from applying db/migrations (then run scripts/migrate.js)
 *
 * Usage:
 *   const { query, withTransaction, isPostgresEnabled } = require('../shared/postgres');
 *   const { rows } = await query('SELECT * FROM audit_log WHERE company_id = $1', [companyId]);
 *   await withTransaction(async (tx) => { await tx.query(...); await tx.query(...); });
 */

const logger = require('../../utils/logger');

let pool = null;
let override; // tests

function isPostgresEnabled(env = process.env) {
    return !!env.DATABASE_URL;
}

function poolOptions(env = process.env) {
    const n = Number(env.PG_POOL_SIZE);
    return {
        connectionString: env.DATABASE_URL,
        max: Number.isInteger(n) && n > 0 ? n : 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        application_name: `oruinwan-${require('./processRole').role}`,
        ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    };
}

/** The shared pool, or null when DATABASE_URL is not set. */
function getPool() {
    if (override !== undefined) return override;
    if (pool || !isPostgresEnabled()) return pool;
    const { Pool } = require('pg');
    pool = new Pool(poolOptions());
    pool.on('error', (err) => logger.error('❌ [POSTGRES] idle client error:', err.message));
    return pool;
}

function requirePool() {
    const p = getPool();
    if (!p) throw new Error('PostgreSQL is not configured (DATABASE_URL)');
    return p;
}

/** Run one statement. */
function query(text, params = []) {
    return requirePool().query(text, params);
}

/**
 * Run `fn(tx)` inside BEGIN/COMMIT; any throw rolls back. `tx.query` has the
 * same signature as `query`.
 */
async function withTransaction(fn) {
    const client = await requirePool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn({ query: (text, params = []) => client.query(text, params), client });
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* connection is gone */ }
        throw err;
    } finally {
        client.release();
    }
}

/** 'disabled' | 'ok' | 'down' for the health check. */
async function postgresStatus() {
    if (!isPostgresEnabled()) return 'disabled';
    try {
        await query('SELECT 1');
        return 'ok';
    } catch {
        return 'down';
    }
}

async function connectPostgres({ migrate = process.env.PG_AUTO_MIGRATE !== 'false' } = {}) {
    if (!isPostgresEnabled()) {
        logger.info('ℹ️  [POSTGRES] DATABASE_URL not set — PostgreSQL-backed features are off');
        return null;
    }
    const p = getPool();
    const { rows } = await p.query('SELECT current_database() AS db, version() AS version');
    logger.success(`PostgreSQL Connected ✔ (${rows[0].db}, ${rows[0].version.split(' ').slice(0, 2).join(' ')})`);
    if (migrate) {
        const { runMigrations } = require('./migrations');
        const applied = await runMigrations();
        if (applied.length) logger.info(`[POSTGRES] Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    }
    return p;
}

async function closePostgres() {
    if (!pool) return;
    const p = pool;
    pool = null;
    await p.end().catch(() => {});
}

/** Test hook: inject a fake pool (object with query/connect) or null. */
function _setPoolForTests(fake) {
    override = fake;
}

module.exports = { getPool, query, withTransaction, postgresStatus, connectPostgres, closePostgres, isPostgresEnabled, poolOptions, _setPoolForTests };
