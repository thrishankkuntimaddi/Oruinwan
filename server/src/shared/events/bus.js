'use strict';

/**
 * The event bus. One Redis Stream (`oruinwan:events`) carries every catalogue
 * event; consumer groups let each consumer kind (webhooks, AI, …) read it at
 * its own pace, on any process, with at-least-once delivery.
 *
 * Publishing picks the safest path available:
 *   Redis + PostgreSQL  -> row in event_outbox; the relay job (outboxRelay.js)
 *                          copies it to the stream, so an event written next to
 *                          a database change is never lost if the process dies
 *   Redis only          -> XADD straight to the stream (best effort)
 *   neither             -> in-process EventEmitter, so a single-box dev setup
 *                          and tests still see events
 *
 * Handlers must be idempotent: a crash after the handler but before XACK means
 * the same event is delivered again (reclaimPending).
 */

const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const logger = require('../../../utils/logger');
const { getRedis, createSubscriber, INSTANCE_ID } = require('../redis');
const { query, isPostgresEnabled } = require('../postgres');
const { assertPayload } = require('./catalog');

const STREAM = 'oruinwan:events';
const MAXLEN = 100_000;
const FIELD = 'event';
const RECLAIM_EVERY_MS = 60_000;
const RECLAIM_IDLE_MS = 60_000;

const local = new EventEmitter();
local.setMaxListeners(50);

let redisOverride; // tests: a fake client (must support duplicate()) or null
const redis = () => (redisOverride !== undefined ? redisOverride : getRedis());
const blockingClient = () => (redisOverride !== undefined ? (redisOverride ? redisOverride.duplicate() : null) : createSubscriber());

function hasRedis() {
    return !!redis();
}

/** 'outbox' | 'stream' | 'local' */
function mode() {
    if (!hasRedis()) return 'local';
    return isPostgresEnabled() ? 'outbox' : 'stream';
}

function envelope(name, payload, { companyId = null, workspaceId = null, actorId = null } = {}) {
    return {
        id: randomUUID(),
        name,
        at: new Date().toISOString(),
        companyId: companyId == null ? null : String(companyId),
        workspaceId: workspaceId == null ? null : String(workspaceId),
        actorId: actorId == null ? null : String(actorId),
        payload,
    };
}

async function xaddEnvelope(client, env) {
    return client.xadd(STREAM, 'MAXLEN', '~', MAXLEN, '*', FIELD, JSON.stringify(env));
}

/**
 * Publish a catalogue event. Resolves to the event id. Throws only on an
 * unknown event or bad payload, or when the outbox insert itself fails;
 * callers that must never fail the user action wrap it in `.catch`.
 * @param {object} [ctx]  { companyId, workspaceId, actorId, tx } — `tx` from withTransaction
 */
async function publish(name, payload, ctx = {}) {
    assertPayload(name, payload);
    const env = envelope(name, payload, ctx);
    const m = mode();
    if (m === 'outbox') {
        const run = ctx.tx && typeof ctx.tx.query === 'function' ? ctx.tx.query : query;
        await run(
            `INSERT INTO event_outbox (event_id, name, company_id, workspace_id, actor_id, payload, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [env.id, env.name, env.companyId, env.workspaceId, env.actorId, JSON.stringify(env.payload), env.at]
        );
    } else if (m === 'stream') {
        await xaddEnvelope(redis(), env);
    } else {
        setImmediate(() => local.emit('event', env));
    }
    return env.id;
}

/** Build the envelope an outbox row stands for (used by the relay). */
function envelopeFromRow(row) {
    return {
        id: row.event_id,
        name: row.name,
        at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        companyId: row.company_id,
        workspaceId: row.workspace_id,
        actorId: row.actor_id,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    };
}

function parseEntries(reply) {
    // XREADGROUP: [[stream, [[id, [field, value, ...]], ...]]]; XAUTOCLAIM: [next, [[id, fields]], ...]
    const out = [];
    for (const [id, fields] of reply || []) {
        if (!Array.isArray(fields)) continue; // a deleted entry shows up as null fields
        const i = fields.indexOf(FIELD);
        if (i < 0) continue;
        try { out.push({ streamId: id, env: JSON.parse(fields[i + 1]) }); } catch { /* skip garbage */ }
    }
    return out;
}

function matches(events, name) {
    return events.includes('*') || events.includes(name);
}

async function ensureGroup(client, group) {
    try {
        // '$': a brand-new group starts at the live edge; it does not replay history.
        await client.xgroup('CREATE', STREAM, group, '$', 'MKSTREAM');
    } catch (err) {
        if (!/BUSYGROUP/.test(err.message)) throw err;
    }
}

/**
 * Deliver a batch of entries to the handler and XACK the ones that succeed.
 * Failures stay pending so `reclaimPending` retries them later.
 */
async function deliver(client, group, entries, handler, events) {
    let acked = 0;
    for (const { streamId, env } of entries) {
        if (!matches(events, env.name)) {
            await client.xack(STREAM, group, streamId); // not ours: ack so it does not stay pending forever
            continue;
        }
        try {
            await handler(env);
            await client.xack(STREAM, group, streamId);
            acked += 1;
        } catch (err) {
            logger.warn(`[EVENTS] ${group} handler failed for ${env.name} (${env.id}): ${err.message}; left pending`);
        }
    }
    return acked;
}

/** Re-deliver entries another (dead) consumer left pending for longer than RECLAIM_IDLE_MS. */
async function reclaimPending(client, group, consumer, handler, events, { idleMs = RECLAIM_IDLE_MS, count = 50 } = {}) {
    const reply = await client.xautoclaim(STREAM, group, consumer, idleMs, '0-0', 'COUNT', count);
    const entries = parseEntries(reply && reply[1]);
    if (!entries.length) return 0;
    return deliver(client, group, entries, handler, events);
}

/**
 * Subscribe a consumer group to the stream. Resolves to a stop function.
 * Without Redis the handler is attached to the in-process emitter.
 */
async function subscribe(group, handler, { consumer = INSTANCE_ID, events = ['*'], batch = 50, blockMs = 5000, reclaimEveryMs = RECLAIM_EVERY_MS } = {}) {
    if (typeof handler !== 'function') throw new Error('subscribe needs a handler');
    if (!hasRedis()) {
        const onEvent = (env) => {
            if (!matches(events, env.name)) return;
            Promise.resolve().then(() => handler(env)).catch((err) => logger.warn(`[EVENTS] ${group} local handler failed for ${env.name}: ${err.message}`));
        };
        local.on('event', onEvent);
        return () => local.off('event', onEvent);
    }

    const client = blockingClient();
    await ensureGroup(client, group);
    let stopped = false;

    const reclaimTimer = setInterval(() => {
        reclaimPending(client, group, consumer, handler, events, { count: batch })
            .catch((err) => { if (!stopped) logger.warn(`[EVENTS] ${group} reclaim failed: ${err.message}`); });
    }, reclaimEveryMs);
    if (reclaimTimer.unref) reclaimTimer.unref();

    (async () => {
        while (!stopped) {
            try {
                const reply = await client.xreadgroup('GROUP', group, consumer, 'COUNT', batch, 'BLOCK', blockMs, 'STREAMS', STREAM, '>');
                if (!reply) continue; // BLOCK timed out
                for (const [, raw] of reply) {
                    await deliver(client, group, parseEntries(raw), handler, events);
                }
            } catch (err) {
                if (stopped) break;
                logger.warn(`[EVENTS] ${group} read failed: ${err.message}; retrying`);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    })().catch(() => {});

    logger.info(`[EVENTS] consumer group "${group}" listening as ${consumer}`);
    return async () => {
        stopped = true;
        clearInterval(reclaimTimer);
        // Closing the blocking connection aborts the XREADGROUP in flight.
        try { client.disconnect(); } catch { /* already gone */ }
    };
}

/** Test hook: inject a fake Redis client (needs duplicate()) or null for local mode. */
function _setRedisForTests(fake) {
    redisOverride = fake;
}

module.exports = {
    publish, subscribe, reclaimPending, hasRedis, mode, envelope, envelopeFromRow, xaddEnvelope, parseEntries,
    STREAM, FIELD, MAXLEN, _local: local, _setRedisForTests,
};
