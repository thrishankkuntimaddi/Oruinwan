'use strict';

/**
 * Pro, paid online (Slack-style): a workspace owner subscribes the workspace, the quantity is its
 * member count, and everyone in it gets Pro. Razorpay is the source of truth; its webhook keeps
 * our copy current and switches the plan columns:
 *
 *   workspaces.plan  'pro' while a subscription is active or retrying a charge, back to 'free' after
 *   users.plan       the owner's own Pro (workspaces, devices, AI) while they pay for any workspace
 *
 * Plans set by hand stay as they are: 'enterprise' is never touched, and a 'pro' set by SQL
 * (no online subscription) is never switched back to free. See docs/BUSINESS_MODEL.md §7.
 */

const razorpay = require('./razorpay');
const repo = require('./subscriptions.repository');
const { unitAmount } = require('./prices');
const logger = require('../../../utils/logger');

const deps = {
    repo,
    razorpay: () => razorpay.client(),
    seats: (workspaceId) => require('../../identity/queries/workspaces').countSeats(workspaceId),
    clearPlanCache: () => require('../../shared/plans/planService')._clearCache(),
    membership: (workspaceId, userId) => require('../../identity').workspaces.membership(workspaceId, userId),
};

const httpError = (status, message, code) => Object.assign(new Error(message), { status, code });

/** What the apps need to show checkout: on/off, the public key, and the choices with prices. */
function publicConfig(env = process.env) {
    const on = razorpay.enabled(env);
    return {
        enabled: on,
        provider: on ? 'razorpay' : null,
        keyId: on ? razorpay.config(env).keyId : null,
        offers: on ? razorpay.offered(env).map((o) => ({ ...o, unitAmount: unitAmount(o.cycle, o.currency) })) : [],
    };
}

function summary(sub, { seats = null } = {}) {
    if (!sub) return null;
    const unit = unitAmount(sub.cycle, sub.currency);
    return {
        status: sub.status,
        active: repo.PRO_STATUSES.includes(sub.status),
        cycle: sub.cycle,
        currency: sub.currency,
        quantity: sub.quantity,
        seats,
        unitAmount: unit,
        amount: unit === null ? null : unit * sub.quantity,
        currentEnd: sub.currentEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        shortUrl: sub.status === 'created' ? sub.shortUrl : null,
    };
}

/** Only the workspace owner buys or cancels; owner or admins can look. */
async function requireRole(workspaceId, userId, { owner = true } = {}) {
    const access = await deps.membership(workspaceId, userId);
    if (!access || !access.member) throw httpError(404, 'Workspace not found');
    if (owner ? access.role !== 'owner' : !access.isAdmin) {
        throw httpError(403, owner ? 'Only the workspace owner can change its plan' : 'Only workspace admins can see billing');
    }
    return access.workspace;
}

/** Billing state of one workspace. */
async function workspaceStatus(workspaceId, userId) {
    await requireRole(workspaceId, userId, { owner: false });
    const [row, sub, seats, payments] = await Promise.all([
        deps.repo.workspacePlanRow(workspaceId),
        deps.repo.latestForWorkspace(workspaceId),
        deps.seats(workspaceId),
        deps.repo.paymentsFor(workspaceId),
    ]);
    return {
        workspaceId: String(workspaceId),
        plan: row?.company_id ? 'company' : row?.plan || 'free',
        seats,
        subscription: summary(sub, { seats }),
        payments,
        billing: publicConfig(),
    };
}

/** Every workspace the user owns, with its plan and subscription, for the pricing page. */
async function ownedStatus(userId) {
    const rows = await deps.repo.ownedWorkspaces(userId);
    const out = [];
    for (const w of rows) {
        const [sub, seats] = await Promise.all([deps.repo.latestForWorkspace(w.id), deps.seats(w.id)]);
        out.push({ workspaceId: w.id, name: w.name, plan: w.plan || 'free', seats, subscription: summary(sub, { seats }) });
    }
    return { workspaces: out, billing: publicConfig() };
}

/**
 * Start checkout: a Razorpay subscription for the workspace's member count. The web app opens
 * Razorpay Checkout with `subscriptionId`; the phone and desktop apps open `shortUrl` (Razorpay's
 * hosted payment page) in the browser.
 */
async function startCheckout(workspaceId, user, { cycle, currency } = {}) {
    if (!razorpay.enabled()) throw httpError(503, 'Online payments are not set up yet. Write to admin@poelys.com to upgrade.', 'BILLING_OFF');
    if (!razorpay.CYCLES.includes(cycle)) throw httpError(400, 'Choose monthly or yearly billing');
    if (!razorpay.CURRENCIES.includes(currency)) throw httpError(400, 'Choose USD or INR');
    const planId = razorpay.planIdFor(cycle, currency);
    if (!planId) throw httpError(400, `${cycle} billing in ${currency} is not available`);

    const ws = await requireRole(workspaceId, user.id);
    const row = await deps.repo.workspacePlanRow(workspaceId);
    if (row?.company_id || row?.plan === 'enterprise') throw httpError(409, 'This workspace already has no plan limits');
    const current = await deps.repo.activeForWorkspace(workspaceId);
    if (current) throw httpError(409, 'This workspace already has a Pro subscription', 'ALREADY_PRO');

    const quantity = Math.max(1, await deps.seats(workspaceId));
    const sub = await deps.razorpay().createSubscription({
        planId, cycle, quantity, email: user.email || undefined,
        notes: { workspaceId: String(workspaceId), ownerId: String(user.id), workspaceName: String(ws?.name || '').slice(0, 200) },
    });
    await deps.repo.insert({
        workspaceId, ownerId: user.id, providerSubscriptionId: sub.id, providerPlanId: planId,
        cycle, currency, quantity, status: sub.status || 'created', shortUrl: sub.short_url,
    });
    const unit = unitAmount(cycle, currency);
    return {
        provider: 'razorpay',
        keyId: razorpay.config().keyId,
        subscriptionId: sub.id,
        shortUrl: sub.short_url || null,
        quantity,
        cycle,
        currency,
        unitAmount: unit,
        amount: unit === null ? null : unit * quantity,
        workspaceName: ws?.name || '',
    };
}

/** Bring both plan columns in line with the workspace's subscriptions. */
async function reconcile(workspaceId, ownerId) {
    const row = await deps.repo.workspacePlanRow(workspaceId);
    if (row && !row.company_id && row.plan !== 'enterprise') {
        const paying = await deps.repo.activeForWorkspace(workspaceId);
        if (paying && row.plan !== 'pro') await deps.repo.setWorkspacePlan(workspaceId, 'pro');
        if (!paying && row.plan === 'pro') await deps.repo.setWorkspacePlan(workspaceId, 'free');
    }
    if (ownerId) {
        const u = await deps.repo.userPlanRow(ownerId);
        if (u && u.plan !== 'enterprise') {
            const paysAny = await deps.repo.ownerHasActive(ownerId);
            if (paysAny && u.plan !== 'pro') await deps.repo.setUserPlan(ownerId, 'pro');
            if (!paysAny && u.plan === 'pro' && (await deps.repo.ownerHasAny(ownerId))) await deps.repo.setUserPlan(ownerId, 'free');
        }
    }
    deps.clearPlanCache();
}

/** Razorpay's subscription entity → our row → plan columns. Unknown subscriptions are ignored. */
async function applyEntity(entity) {
    if (!entity?.id) return null;
    const sub = await deps.repo.updateFromEntity(entity);
    if (!sub) {
        logger.warn({ subscription: entity.id }, '[billing] webhook for a subscription we did not create');
        return null;
    }
    await reconcile(sub.workspaceId, sub.ownerId);
    return sub;
}

/**
 * After Razorpay Checkout succeeds in the web app: check its signature, then read the
 * subscription back from Razorpay so the workspace is on Pro before the webhook arrives.
 */
async function verifyCheckout(workspaceId, userId, { paymentId, subscriptionId, signature } = {}) {
    if (!razorpay.verifyPaymentSignature({ paymentId, subscriptionId, signature })) throw httpError(400, 'Payment could not be verified');
    const mine = await deps.repo.findByProviderId(subscriptionId);
    if (!mine || mine.workspaceId !== String(workspaceId)) throw httpError(404, 'Subscription not found');
    await requireRole(workspaceId, userId, { owner: false });
    const entity = await deps.razorpay().fetchSubscription(subscriptionId);
    await applyEntity(entity);
    return workspaceStatus(workspaceId, userId);
}

/** Stop renewing; the workspace stays on Pro until the paid period ends. */
async function cancel(workspaceId, userId) {
    await requireRole(workspaceId, userId);
    const sub = await deps.repo.activeForWorkspace(workspaceId);
    if (!sub) throw httpError(404, 'This workspace has no active subscription');
    const entity = await deps.razorpay().cancel(sub.providerSubscriptionId, { atCycleEnd: true });
    await deps.repo.setCancelAtPeriodEnd(sub.providerSubscriptionId, true);
    if (entity?.id) await applyEntity(entity);
    return workspaceStatus(workspaceId, userId);
}

/** Update the quantity to the member count from the next charge on. Returns the new quantity or null. */
async function syncSeats(sub) {
    const seats = Math.max(1, await deps.seats(sub.workspaceId));
    if (seats === sub.quantity || sub.cancelAtPeriodEnd) return null;
    await deps.razorpay().updateQuantity(sub.providerSubscriptionId, seats);
    await deps.repo.setQuantity(sub.providerSubscriptionId, seats);
    return seats;
}

/** Daily: every active subscription's quantity follows its member count. */
async function syncAllSeats() {
    if (!razorpay.enabled()) return { checked: 0, changed: 0 };
    const subs = await deps.repo.listActive();
    let changed = 0;
    for (const sub of subs) {
        try {
            if ((await syncSeats(sub)) !== null) changed += 1;
        } catch (err) {
            logger.warn({ err: err.message, subscription: sub.providerSubscriptionId }, '[billing] seat sync failed');
        }
    }
    return { checked: subs.length, changed };
}

const SUBSCRIPTION_EVENTS = new Set([
    'subscription.authenticated', 'subscription.activated', 'subscription.charged', 'subscription.pending',
    'subscription.halted', 'subscription.cancelled', 'subscription.completed', 'subscription.paused',
    'subscription.resumed', 'subscription.updated',
]);

/**
 * One webhook delivery (signature already checked). Retries of the same event id are skipped;
 * if handling fails the id is forgotten so Razorpay's retry runs it again.
 */
async function handleWebhook(body, eventId) {
    const event = body?.event;
    if (!SUBSCRIPTION_EVENTS.has(event)) return { handled: false, event };
    const id = eventId || `${event}:${body?.payload?.subscription?.entity?.id}:${body?.created_at}`;
    if (!(await deps.repo.markEvent(id, 'razorpay', event))) return { handled: false, duplicate: true, event };
    try {
        const entity = body?.payload?.subscription?.entity;
        const sub = await applyEntity(entity);
        const payment = body?.payload?.payment?.entity;
        if (sub && payment) await deps.repo.recordPayment(payment, { subscriptionId: entity.id, workspaceId: sub.workspaceId });
        return { handled: Boolean(sub), event };
    } catch (err) {
        await deps.repo.forgetEvent(id).catch(() => {});
        throw err;
    }
}

module.exports = {
    deps, publicConfig, summary, workspaceStatus, ownedStatus, startCheckout, verifyCheckout, cancel,
    reconcile, applyEntity, syncSeats, syncAllSeats, handleWebhook, SUBSCRIPTION_EVENTS,
};
