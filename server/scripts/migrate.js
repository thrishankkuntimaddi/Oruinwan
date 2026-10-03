#!/usr/bin/env node
'use strict';

/**
 * Apply PostgreSQL migrations from server/db/migrations.
 *
 *   node scripts/migrate.js            apply pending
 *   node scripts/migrate.js --status   list applied and pending
 */

require('dotenv').config();
const { runMigrations, migrationStatus } = require('../src/shared/migrations');
const { closePostgres } = require('../src/shared/postgres');

(async () => {
    if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }
    if (process.argv.includes('--status')) {
        const s = await migrationStatus();
        console.log(`applied: ${s.applied.length ? s.applied.join(', ') : 'none'}`);
        console.log(`pending: ${s.pending.length ? s.pending.join(', ') : 'none'}`);
    } else {
        const applied = await runMigrations();
        console.log(applied.length ? `applied ${applied.length}: ${applied.join(', ')}` : 'nothing to apply');
    }
    await closePostgres();
})().catch((err) => { console.error(err.message); process.exit(1); });
