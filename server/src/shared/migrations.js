'use strict';

/**
 * SQL migrations for PostgreSQL. Files live in server/db/migrations as
 * NNNN_name.sql and run in order, each inside its own transaction, recorded in
 * schema_migrations. A file that has run is never run again, so edits go in a
 * new file. Boot applies pending files unless PG_AUTO_MIGRATE=false; the same
 * runner is `node scripts/migrate.js`.
 *
 * A migration that must not run in a transaction (CREATE INDEX CONCURRENTLY)
 * starts with the line `-- no-transaction`.
 */

const fs = require('fs');
const path = require('path');
const { requirePoolForMigrations } = (() => ({ requirePoolForMigrations: () => require('./postgres').getPool() }))();

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

function listMigrationFiles(dir = MIGRATIONS_DIR) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/i.test(f))
        .sort();
}

async function ensureTable(pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
    )`);
}

async function appliedMigrations(pool) {
    const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
    return rows.map((r) => r.name);
}

/** Apply every pending file. Returns the names applied. */
async function runMigrations({ pool = requirePoolForMigrations(), dir = MIGRATIONS_DIR } = {}) {
    if (!pool) throw new Error('PostgreSQL is not configured (DATABASE_URL)');
    await ensureTable(pool);
    // One runner at a time across all processes booting together.
    const lock = await pool.connect();
    const applied = [];
    try {
        await lock.query('SELECT pg_advisory_lock(727001)');
        const done = new Set(await appliedMigrations(pool));
        for (const file of listMigrationFiles(dir)) {
            if (done.has(file)) continue;
            const sql = fs.readFileSync(path.join(dir, file), 'utf8');
            const noTx = /^--\s*no-transaction/m.test(sql);
            const client = await pool.connect();
            try {
                if (!noTx) await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                if (!noTx) await client.query('COMMIT');
                applied.push(file);
            } catch (err) {
                if (!noTx) await client.query('ROLLBACK').catch(() => {});
                err.message = `migration ${file}: ${err.message}`;
                throw err;
            } finally {
                client.release();
            }
        }
    } finally {
        await lock.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
        lock.release();
    }
    return applied;
}

/** { applied: [...], pending: [...] } without changing anything. */
async function migrationStatus({ pool = requirePoolForMigrations(), dir = MIGRATIONS_DIR } = {}) {
    if (!pool) throw new Error('PostgreSQL is not configured (DATABASE_URL)');
    await ensureTable(pool);
    const done = await appliedMigrations(pool);
    const all = listMigrationFiles(dir);
    return { applied: done, pending: all.filter((f) => !done.includes(f)) };
}

module.exports = { runMigrations, migrationStatus, listMigrationFiles, MIGRATIONS_DIR };
