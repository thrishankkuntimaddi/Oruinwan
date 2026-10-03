'use strict';

/**
 * Outbox relay: moves rows from event_outbox (PostgreSQL) to the Redis Stream.
 * Runs every 2s on a jobs process. Rows are taken FOR UPDATE SKIP LOCKED, so
 * two relays can run at once without publishing the same row twice; the
 * scheduler lock on top just keeps the second one idle.
 *
 * Published rows are kept OUTBOX_RETENTION_DAYS (default 7) for debugging,
 * then pruned once an hour.
 */

const logger = require('../../../utils/logger');
const { withTransaction, isPostgresEnabled, query } = require('../postgres');
const { serves } = require('../processRole');
const { scheduleJob } = require('../jobs/scheduler');
const bus = require('./bus');
const { getRedis } = require('../redis');

const INTERVAL_MS = 2000;
const BATCH = 500;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

let lastPrune = 0;

function retentionDays(env = process.env) {
    const n = Number(env.OUTBOX_RETENTION_DAYS);
    return Number.isFinite(n) && n >= 0 ? n : 7;
}

/**
 * One pass: publish up to `limit` unpublished rows. Resolves to the number
 * relayed. `redis` can be injected for tests.
 */
async function relayOnce({ redis = getRedis(), limit = BATCH } = {}) {
    if (!redis || !isPostgresEnabled()) return 0;
    const relayed = await withTransaction(async (tx) => {
        const { rows } = await tx.query(
            `SELECT id, event_id, name, company_id, workspace_id, actor_id, payload, created_at
               FROM event_outbox
              WHERE published_at IS NULL
              ORDER BY id
              LIMIT $1
              FOR UPDATE SKIP LOCKED`,
            [limit]
        );
        if (!rows.length) return 0;
        for (const row of rows) await bus.xaddEnvelope(redis, bus.envelopeFromRow(row));
        await tx.query('UPDATE event_outbox SET published_at = now() WHERE id = ANY($1::bigint[])', [rows.map((r) => r.id)]);
        return rows.length;
    });
    if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
        lastPrune = Date.now();
        await prunePublished().catch((err) => logger.warn(`[EVENTS] outbox prune failed: ${err.message}`));
    }
    return relayed;
}

async function prunePublished(days = retentionDays()) {
    const { rowCount } = await query(
        `DELETE FROM event_outbox WHERE published_at IS NOT NULL AND published_at < now() - ($1::int * interval '1 day')`,
        [days]
    );
    if (rowCount) logger.info(`[EVENTS] pruned ${rowCount} published outbox row(s) older than ${days} day(s)`);
    return rowCount;
}

/** Schedule the relay on this process when it runs jobs and both stores exist. Returns a stop function. */
function startOutboxRelay() {
    if (!serves.jobs) return () => {};
    if (!isPostgresEnabled() || !bus.hasRedis()) {
        logger.info(`[EVENTS] outbox relay not started (mode: ${bus.mode()})`);
        return () => {};
    }
    const stop = scheduleJob({
        name: 'outbox-relay',
        intervalMs: INTERVAL_MS,
        lockTtlMs: 1500,
        run: async () => {
            // Drain: keep going while full batches come back, so a burst clears quickly.
            let n;
            do { n = await relayOnce(); } while (n === BATCH);
        },
    });
    logger.info('[EVENTS] outbox relay started (every 2s)');
    return stop;
}

module.exports = { relayOnce, prunePublished, startOutboxRelay, retentionDays, INTERVAL_MS, BATCH };
