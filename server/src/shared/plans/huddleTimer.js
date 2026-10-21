'use strict';

/**
 * The free plan's 30-minute call cap.
 *
 * Every instance sweeps its copy of the huddle registry (kept identical across
 * instances by huddleReplication). For a call on a limited plan it sends
 *   huddle:time_warning  at (limit - 5) and (limit - 1) minutes
 *   and ends the call    at the limit (huddle:ended, reason 'time_limit')
 * Each step is a one-shot claim (Redis / MongoDB, see planCounters.claim), so
 * however many instances run the sweep, it happens once per call. Room emits
 * reach every participant through the Socket.IO Redis adapter. Meeting notes
 * are kept: ending a call completes its meeting as any other end does.
 */

const logger = require('../../../utils/logger');

const WARN_BEFORE_MINUTES = [5, 1];
const SWEEP_MS = 5000;

const TIME_LIMIT_MESSAGE = (minutes) => `This call ended at the free plan's ${minutes}-minute limit. Your notes are saved in the meeting notes.`;

function startedAtOf(huddle) {
    const t = huddle.startedAt instanceof Date ? huddle.startedAt.getTime() : Date.parse(huddle.startedAt);
    return Number.isFinite(t) ? t : null;
}

/**
 * { maxMinutes, startedAt, endsAt } for a call, or null when its plan has no time limit.
 * The plan is the server-resolved workspace's, or for a call outside any workspace
 * its opener's (huddle.planUserId).
 */
async function timeLimitFor(huddle, limitsFor) {
    if (!huddle) return null;
    const { planSourceOf } = require('../../modules/huddles/huddleRegistry');
    const source = planSourceOf(huddle);
    if (!source.workspaceId && !source.userId) return null;
    const limits = source.workspaceId ? await limitsFor(source.workspaceId) : await limitsFor(null, { userId: source.userId });
    if (!limits || !limits.minutes) return null;
    const start = startedAtOf(huddle);
    if (start === null) return null;
    return { maxMinutes: limits.minutes, startedAt: new Date(start).toISOString(), endsAt: new Date(start + limits.minutes * 60000).toISOString(), plan: limits.plan };
}

/**
 * One sweep. Exposed for tests; the interval just calls this.
 * deps: { io, registry, limitsFor(workspaceId), claim(key, ttlSec), endHuddle(io, huddleId, reason), now() }
 */
async function sweep(deps) {
    const { io, registry, limitsFor, claim, endHuddle, now = () => Date.now() } = deps;
    const t = now();
    for (const huddle of [...registry.huddles.values()]) {
        try {
            if (!huddle.participants || huddle.participants.size === 0) continue;
            const limit = await timeLimitFor(huddle, limitsFor);
            if (!limit) continue;
            const start = startedAtOf(huddle);
            const elapsedMin = (t - start) / 60000;
            const tag = `huddle-limit:${huddle.huddleId}:${start}`;
            if (elapsedMin >= limit.maxMinutes) {
                if (await claim(`${tag}:end`, 3600)) {
                    endHuddle(io, huddle.huddleId, 'time_limit');
                    logger.info(`[plans] call ${huddle.huddleId} ended at its ${limit.maxMinutes}-minute limit`);
                }
                continue;
            }
            for (const before of WARN_BEFORE_MINUTES) {
                const at = limit.maxMinutes - before;
                if (at <= 0 || elapsedMin < at) continue;
                // Only the latest warning that is due; an older one is not sent late.
                const later = WARN_BEFORE_MINUTES.filter((b) => b < before && elapsedMin >= limit.maxMinutes - b);
                if (later.length) continue;
                if (await claim(`${tag}:warn${before}`, 3600)) {
                    io.to(`huddle:${huddle.huddleId}`).emit('huddle:time_warning', {
                        huddleId: huddle.huddleId,
                        meetingId: huddle.meetingId || null,
                        minutesLeft: before,
                        endsAt: limit.endsAt,
                        maxMinutes: limit.maxMinutes,
                        plan: limit.plan || 'free',
                        message: before === 1
                            ? `1 minute left — free plan calls end at ${limit.maxMinutes} minutes.`
                            : `${before} minutes left — free plan calls end at ${limit.maxMinutes} minutes.`,
                    });
                }
            }
        } catch (err) {
            logger.warn({ err: err?.message, huddleId: huddle?.huddleId }, '[plans] call time check failed');
        }
    }
}

/** Start the sweep on this instance. Returns a stop function. */
function startHuddleTimer({ io, registry, limitsFor, claim, endHuddle, intervalMs = SWEEP_MS } = {}) {
    if (!io || !registry) return () => {};
    const deps = {
        io,
        registry,
        limitsFor: limitsFor || ((workspaceId, opts) => require('./planService').huddleLimits(workspaceId, opts)),
        claim: claim || ((key, ttl) => require('./planCounters').claim(key, ttl)),
        endHuddle: endHuddle || ((ioRef, huddleId, reason) => require('../../modules/huddles/huddles.socket').endHuddle(ioRef, huddleId, reason)),
    };
    let running = false;
    const timer = setInterval(() => {
        if (running) return;
        running = true;
        sweep(deps).finally(() => { running = false; });
    }, intervalMs);
    if (timer.unref) timer.unref();
    return () => clearInterval(timer);
}

module.exports = { sweep, startHuddleTimer, timeLimitFor, TIME_LIMIT_MESSAGE, WARN_BEFORE_MINUTES };
