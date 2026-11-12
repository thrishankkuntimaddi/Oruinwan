'use strict';

/**
 * Server-wide daily AI spend guard for requests answered with the server's own AI key
 * (the per-person and per-workspace counters in aiQuota.js cap one account; this caps the
 * bill when many free workspaces use AI on the same day).
 *
 *   AI_DAILY_BUDGET_USD=25          estimated spend per UTC day before free requests pause
 *                                   ("off" or 0 = no guard). Paid plans keep working up to
 *                                   twice the budget, then pause too.
 *   AI_COST_PER_REQUEST_USD=0.011   estimate per request (docs/BUSINESS_MODEL.md unit economics)
 *   AI_BUDGET_WARN_AT=0.8           log one warning per day at this share of the budget
 *
 * Counter: ai:s:<YYYY-MM-DD> (requests), shared by every server instance through planCounters.
 */

const counters = require('./planCounters');
const { PlanLimitError } = require('./plans');

const PAID_CEILING = 2;

function settings(env = process.env) {
    const raw = String(env.AI_DAILY_BUDGET_USD ?? '25').trim().toLowerCase();
    const budget = raw === 'off' || raw === '' ? 0 : Number(raw);
    const cost = Number(env.AI_COST_PER_REQUEST_USD ?? 0.011);
    const warnAt = Number(env.AI_BUDGET_WARN_AT ?? 0.8);
    return {
        budget: Number.isFinite(budget) && budget > 0 ? budget : 0,
        cost: Number.isFinite(cost) && cost > 0 ? cost : 0.011,
        warnAt: Number.isFinite(warnAt) && warnAt > 0 && warnAt < 1 ? warnAt : 0.8,
    };
}

const key = (day) => `ai:s:${day}`;
const round = (n) => Math.round(n * 100) / 100;

/**
 * Counts one server-key request against today's budget. `paid` = the person or workspace is on
 * a paid plan. Throws PlanLimitError('ai.serverDaily') when the day's budget is spent; the
 * refused request gives its count back. Returns { used, estimatedUsd, budgetUsd } or null (off).
 */
async function charge({ day, ttl, paid = false, env = process.env, log = () => {} }) {
    const { budget, cost, warnAt } = settings(env);
    if (!budget) return null;
    const n = await counters.incr(key(day), 1, ttl);
    const spent = n * cost;
    const limit = paid ? budget * PAID_CEILING : budget;
    if (spent > limit) {
        await counters.incr(key(day), -1, ttl).catch(() => {});
        // Tell the operator once a day that free (or, past the ceiling, paid) AI paused.
        const first = await counters.incr(`${key(day)}:paused:${paid ? 'paid' : 'free'}`, 1, ttl).catch(() => 0);
        if (first === 1) log('error', `[AI budget] ${paid ? 'paid' : 'free'} AI requests paused for today: ~$${round((n - 1) * cost)} spent (limit $${round(limit)})`);
        throw new PlanLimitError('ai.serverDaily', {
            plan: paid ? 'pro' : 'free',
            message: paid
                ? 'Oruinwan AI has hit today’s safety limit. It is back at midnight UTC, or use your own AI key in Agents & tools.'
                : 'Oruinwan AI is very busy today, so free AI requests are paused until midnight UTC. Pro keeps working, or use your own AI key in Agents & tools.',
        });
    }
    // One warning per day when the estimate crosses the warning line.
    const line = Math.ceil((budget * warnAt) / cost);
    if (n === line) log('warn', `[AI budget] ${Math.round(warnAt * 100)}% of today's AI budget used: ~$${round(spent)} of $${round(budget)} (${n} requests)`);
    return { used: n, estimatedUsd: round(spent), budgetUsd: budget };
}

/** Today's estimate without counting: for the operator (GET /api/plans/ai-budget). */
async function status({ day, env = process.env }) {
    const { budget, cost } = settings(env);
    const [used] = await counters.getMany([key(day)]);
    const n = used || 0;
    return {
        enabled: Boolean(budget),
        requests: n,
        estimatedUsd: round(n * cost),
        budgetUsd: budget || null,
        paidCeilingUsd: budget ? budget * PAID_CEILING : null,
        costPerRequestUsd: cost,
        freePaused: Boolean(budget) && n * cost >= budget,
    };
}

module.exports = { charge, status, settings, PAID_CEILING };
