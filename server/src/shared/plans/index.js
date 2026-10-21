'use strict';

/**
 * Plan limits. See docs/api/plans.md.
 *
 *   plans.js        plans and their numbers (+ env overrides), the PLAN_LIMIT body
 *   planService.js  which plan applies, usage counts, assert* checks
 *   planGuards.js   Express middleware that runs the checks before a create route
 *   aiQuota.js      daily AI counters (server key only), counted in ai.gatewayResolver
 *   huddleTimer.js  30-minute call cap with 25/29-minute warnings
 *   plan.routes.js  GET /api/plan, GET /api/plan/ai
 */

const plans = require('./plans');

/** Answer a PLAN_LIMIT error as HTTP 403 with its body. Returns true when it did. */
function sendPlanLimit(res, err) {
    if (!err || err.code !== 'PLAN_LIMIT') return false;
    const body = err.body || plans.planLimitBody(err.limit || 'unknown', { max: err.max, used: err.used, plan: err.plan, message: err.message });
    res.status(403).json(body);
    return true;
}

module.exports = { ...plans, sendPlanLimit };
