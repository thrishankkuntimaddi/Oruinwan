'use strict';

/**
 * Razorpay Subscriptions: the few REST calls Pro needs, and the two signature checks.
 * https://razorpay.com/docs/api/payments/subscriptions/
 *
 * Settings (server/.env). Billing is off until the key id and secret are set:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   API keys (Dashboard → Account & Settings → API keys)
 *   RAZORPAY_WEBHOOK_SECRET                the secret typed when adding the webhook
 *   RAZORPAY_PLAN_PRO_MONTHLY_USD          plan ids (plan_...) made by scripts/billing/create-razorpay-plans.js;
 *   RAZORPAY_PLAN_PRO_YEARLY_USD           a currency is offered only when its plan id is set
 *   RAZORPAY_PLAN_PRO_MONTHLY_INR
 *   RAZORPAY_PLAN_PRO_YEARLY_INR
 */

const crypto = require('crypto');

const API = 'https://api.razorpay.com/v1';
const CYCLES = ['monthly', 'yearly'];
const CURRENCIES = ['USD', 'INR'];
/** How many charges a subscription allows before it completes (Razorpay needs a number): ~10 years. */
const TOTAL_COUNT = { monthly: 120, yearly: 10 };

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

function config(env = process.env) {
    const plans = {};
    for (const cycle of CYCLES) {
        for (const currency of CURRENCIES) {
            const id = clean(env[`RAZORPAY_PLAN_PRO_${cycle.toUpperCase()}_${currency}`]);
            if (id) plans[`${cycle}:${currency}`] = id;
        }
    }
    return {
        keyId: clean(env.RAZORPAY_KEY_ID),
        keySecret: clean(env.RAZORPAY_KEY_SECRET),
        webhookSecret: clean(env.RAZORPAY_WEBHOOK_SECRET),
        plans,
    };
}

/** Online checkout is on when the API keys and at least one plan id are set. */
function enabled(env = process.env) {
    const c = config(env);
    return Boolean(c.keyId && c.keySecret && Object.keys(c.plans).length);
}

/** The Razorpay plan id for a cycle and currency, or null when that one isn't set up. */
function planIdFor(cycle, currency, env = process.env) {
    return config(env).plans[`${cycle}:${currency}`] || null;
}

/** Cycles and currencies that have a plan id, for the checkout choices. */
function offered(env = process.env) {
    const { plans } = config(env);
    return Object.keys(plans).map((k) => { const [cycle, currency] = k.split(':'); return { cycle, currency }; });
}

function hmacHex(secret, data) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqualHex(a, b) {
    const x = Buffer.from(String(a || ''), 'utf8');
    const y = Buffer.from(String(b || ''), 'utf8');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** Checkout handler's answer: signature = HMAC(payment_id|subscription_id, key secret). */
function verifyPaymentSignature({ paymentId, subscriptionId, signature }, env = process.env) {
    const { keySecret } = config(env);
    if (!keySecret || !paymentId || !subscriptionId || !signature) return false;
    return safeEqualHex(signature, hmacHex(keySecret, `${paymentId}|${subscriptionId}`));
}

/** Webhook: X-Razorpay-Signature = HMAC(raw body, webhook secret). */
function verifyWebhookSignature(rawBody, signature, env = process.env) {
    const { webhookSecret } = config(env);
    if (!webhookSecret || !rawBody || !signature) return false;
    return safeEqualHex(signature, hmacHex(webhookSecret, rawBody));
}

/** A small client. `http` is axios-like ({ request }) so tests can pass a fake. */
function client({ env = process.env, http = require('axios') } = {}) {
    const { keyId, keySecret } = config(env);
    async function call(method, path, data) {
        if (!keyId || !keySecret) throw Object.assign(new Error('Online payments are not set up on this server'), { status: 503 });
        try {
            const res = await http.request({
                method, url: `${API}${path}`, data,
                auth: { username: keyId, password: keySecret },
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' },
            });
            return res.data;
        } catch (err) {
            const desc = err?.response?.data?.error?.description;
            throw Object.assign(new Error(desc || 'The payment provider did not answer'), { status: 502, provider: err?.response?.data?.error || null });
        }
    }
    return {
        createSubscription({ planId, cycle, quantity, notes, email }) {
            return call('post', '/subscriptions', {
                plan_id: planId,
                total_count: TOTAL_COUNT[cycle] || 120,
                quantity: Math.max(1, Number(quantity) || 1),
                customer_notify: 1,
                notes,
                ...(email ? { notify_info: { notify_email: email } } : {}),
            });
        },
        fetchSubscription(id) {
            return call('get', `/subscriptions/${encodeURIComponent(id)}`);
        },
        /** New member count from the next charge on (no mid-cycle proration). */
        updateQuantity(id, quantity) {
            return call('patch', `/subscriptions/${encodeURIComponent(id)}`, { quantity: Math.max(1, Number(quantity) || 1), schedule_change_at: 'cycle_end' });
        },
        cancel(id, { atCycleEnd = true } = {}) {
            return call('post', `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });
        },
        createPlan({ period, amount, currency, name, description }) {
            return call('post', '/plans', { period, interval: 1, item: { name, amount, currency, description } });
        },
    };
}

module.exports = {
    API, CYCLES, CURRENCIES, TOTAL_COUNT,
    config, enabled, planIdFor, offered, client,
    verifyPaymentSignature, verifyWebhookSignature, hmacHex,
};
