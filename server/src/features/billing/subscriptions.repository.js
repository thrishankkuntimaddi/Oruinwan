'use strict';

/**
 * Pro subscriptions, their payments and handled webhook events (migration 0019),
 * plus the two plan columns they switch (workspaces.plan, users.plan).
 */

const { query } = require('../../shared/postgres');
const { newId, str } = require('../../identity/sql');

/** Statuses that keep a workspace on Pro. 'pending' = a charge failed and Razorpay is retrying. */
const PRO_STATUSES = ['active', 'pending'];

const toDate = (unix) => (unix ? new Date(Number(unix) * 1000) : null);

function toSub(r) {
    if (!r) return null;
    return {
        id: r.id,
        workspaceId: r.workspace_id,
        ownerId: r.owner_id,
        provider: r.provider,
        providerSubscriptionId: r.provider_subscription_id,
        providerPlanId: r.provider_plan_id,
        cycle: r.cycle,
        currency: r.currency,
        quantity: r.quantity,
        status: r.status,
        shortUrl: r.short_url,
        currentStart: r.current_start,
        currentEnd: r.current_end,
        cancelAtPeriodEnd: r.cancel_at_period_end,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

async function insert({ workspaceId, ownerId, providerSubscriptionId, providerPlanId, cycle, currency, quantity, status, shortUrl }) {
    const { rows } = await query(
        `INSERT INTO pro_subscriptions (id, workspace_id, owner_id, provider_subscription_id, provider_plan_id, cycle, currency, quantity, status, short_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [newId(), str(workspaceId), str(ownerId), providerSubscriptionId, providerPlanId, cycle, currency, quantity, status || 'created', shortUrl || null]
    );
    return toSub(rows[0]);
}

async function findByProviderId(providerSubscriptionId) {
    const { rows } = await query('SELECT * FROM pro_subscriptions WHERE provider_subscription_id = $1', [String(providerSubscriptionId)]);
    return toSub(rows[0]);
}

/** The newest subscription of a workspace (any status), or null. */
async function latestForWorkspace(workspaceId) {
    const { rows } = await query('SELECT * FROM pro_subscriptions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1', [str(workspaceId)]);
    return toSub(rows[0]);
}

/** The subscription that keeps the workspace on Pro now, or null. */
async function activeForWorkspace(workspaceId) {
    const { rows } = await query(
        'SELECT * FROM pro_subscriptions WHERE workspace_id = $1 AND status = ANY($2) ORDER BY created_at DESC LIMIT 1',
        [str(workspaceId), PRO_STATUSES]
    );
    return toSub(rows[0]);
}

async function listActive() {
    const { rows } = await query('SELECT * FROM pro_subscriptions WHERE status = ANY($1)', [PRO_STATUSES]);
    return rows.map(toSub);
}

/** Copy Razorpay's subscription entity onto our row. Returns the updated row (null if unknown). */
async function updateFromEntity(entity) {
    const { rows } = await query(
        `UPDATE pro_subscriptions SET
            status = COALESCE($2, status),
            quantity = COALESCE($3, quantity),
            current_start = COALESCE($4, current_start),
            current_end = COALESCE($5, current_end),
            short_url = COALESCE($6, short_url),
            cancel_at_period_end = CASE WHEN $2 IN ('cancelled', 'completed', 'expired') THEN false ELSE cancel_at_period_end END,
            updated_at = now()
         WHERE provider_subscription_id = $1 RETURNING *`,
        [String(entity.id), entity.status || null, entity.quantity != null ? Number(entity.quantity) : null,
            toDate(entity.current_start), toDate(entity.current_end), entity.short_url || null]
    );
    return toSub(rows[0]);
}

async function setQuantity(providerSubscriptionId, quantity) {
    await query('UPDATE pro_subscriptions SET quantity = $2, updated_at = now() WHERE provider_subscription_id = $1', [String(providerSubscriptionId), quantity]);
}

async function setCancelAtPeriodEnd(providerSubscriptionId, value) {
    await query('UPDATE pro_subscriptions SET cancel_at_period_end = $2, updated_at = now() WHERE provider_subscription_id = $1', [String(providerSubscriptionId), !!value]);
}

async function workspaceHasAny(workspaceId) {
    const { rows } = await query('SELECT 1 FROM pro_subscriptions WHERE workspace_id = $1 LIMIT 1', [str(workspaceId)]);
    return rows.length > 0;
}

async function ownerHasActive(ownerId) {
    const { rows } = await query('SELECT 1 FROM pro_subscriptions WHERE owner_id = $1 AND status = ANY($2) LIMIT 1', [str(ownerId), PRO_STATUSES]);
    return rows.length > 0;
}

async function ownerHasAny(ownerId) {
    const { rows } = await query('SELECT 1 FROM pro_subscriptions WHERE owner_id = $1 LIMIT 1', [str(ownerId)]);
    return rows.length > 0;
}

/** Razorpay payment entity → a history row (amounts arrive in paise/cents). Idempotent. */
async function recordPayment(payment, { subscriptionId, workspaceId }) {
    if (!payment?.id) return;
    await query(
        `INSERT INTO pro_subscription_payments (provider_payment_id, provider_subscription_id, workspace_id, amount, currency, status, invoice_id, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (provider_payment_id) DO UPDATE SET status = EXCLUDED.status`,
        [String(payment.id), String(subscriptionId), str(workspaceId), (Number(payment.amount) || 0) / 100,
            String(payment.currency || 'INR'), String(payment.status || 'captured'), payment.invoice_id || null,
            toDate(payment.created_at) || new Date()]
    );
}

async function paymentsFor(workspaceId, limit = 24) {
    const { rows } = await query(
        'SELECT * FROM pro_subscription_payments WHERE workspace_id = $1 ORDER BY paid_at DESC LIMIT $2',
        [str(workspaceId), limit]
    );
    return rows.map((r) => ({ id: r.provider_payment_id, amount: Number(r.amount), currency: r.currency, status: r.status, invoiceId: r.invoice_id, paidAt: r.paid_at }));
}

/** True the first time an event id is seen, false for a retried delivery. */
async function markEvent(eventId, provider, event) {
    const { rowCount } = await query(
        'INSERT INTO billing_webhook_events (event_id, provider, event) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [String(eventId), provider, String(event || '')]
    );
    return rowCount > 0;
}

async function forgetEvent(eventId) {
    await query('DELETE FROM billing_webhook_events WHERE event_id = $1', [String(eventId)]);
}

// ── Plan columns ────────────────────────────────────────────────────

async function workspacePlanRow(workspaceId) {
    const { rows } = await query('SELECT id, name, plan, created_by, company_id FROM workspaces WHERE id = $1', [str(workspaceId)]);
    return rows[0] || null;
}

async function setWorkspacePlan(workspaceId, plan) {
    await query('UPDATE workspaces SET plan = $2 WHERE id = $1', [str(workspaceId), plan]);
}

async function userPlanRow(userId) {
    const { rows } = await query('SELECT id, email, plan FROM users WHERE id = $1', [str(userId)]);
    return rows[0] || null;
}

async function setUserPlan(userId, plan) {
    await query('UPDATE users SET plan = $2 WHERE id = $1', [str(userId), plan]);
}

/** Personal workspaces the user owns, with their plan. */
async function ownedWorkspaces(userId) {
    const { rows } = await query(
        `SELECT w.id, w.name, w.plan FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE m.user_id = $1 AND m.role = 'owner' AND m.status = 'active' AND w.is_active = true AND w.company_id IS NULL
         ORDER BY w.name`,
        [str(userId)]
    );
    return rows;
}

module.exports = {
    PRO_STATUSES,
    insert, findByProviderId, latestForWorkspace, activeForWorkspace, listActive, updateFromEntity,
    setQuantity, setCancelAtPeriodEnd, workspaceHasAny, ownerHasActive, ownerHasAny,
    recordPayment, paymentsFor, markEvent, forgetEvent,
    workspacePlanRow, setWorkspacePlan, userPlanRow, setUserPlan, ownedWorkspaces,
};
