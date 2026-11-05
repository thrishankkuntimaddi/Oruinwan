'use strict';

/**
 * /api/billing — Pro paid online with Razorpay (docs/api/billing.md).
 *
 *   GET  /config                          { enabled, provider, keyId, offers: [{ cycle, currency, unitAmount }] }
 *   GET  /workspaces                      workspaces I own, each with plan, seats, subscription
 *   GET  /workspaces/:id                  one workspace (owner or admins): plan, seats, subscription, payments
 *   POST /workspaces/:id/checkout         { cycle, currency } → { subscriptionId, keyId, shortUrl, amount, ... } (owner)
 *   POST /workspaces/:id/verify           { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 *   POST /workspaces/:id/cancel           stop renewing at the end of the paid period (owner)
 *   POST /webhook/razorpay                Razorpay events, checked with X-Razorpay-Signature (no sign-in)
 */

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const razorpay = require('./razorpay');
const service = require('./billing.service');
const repo = require('./subscriptions.repository');
const logger = require('../../../utils/logger');

const router = express.Router();

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function fail(res, err, what) {
    if (err.status && err.status < 600 && err.status !== 500) {
        return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    }
    logger.error({ err }, `[billing] ${what} failed`);
    return res.status(500).json({ message: 'Billing is unavailable right now. Please try again.' });
}

function workspaceParam(req, res, next) {
    if (!isId(String(req.params.id))) return res.status(400).json({ message: 'Invalid workspace id' });
    return next();
}

// Webhook first: Razorpay does not sign in. server.js keeps the raw body for this path.
router.post('/webhook/razorpay', async (req, res) => {
    const signature = req.get('x-razorpay-signature');
    if (!req.rawBody || !razorpay.verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(400).json({ message: 'Invalid signature' });
    }
    try {
        const result = await service.handleWebhook(req.body, req.get('x-razorpay-event-id'));
        return res.json({ ok: true, ...result });
    } catch (err) {
        logger.error({ err, event: req.body?.event }, '[billing] webhook failed');
        // A 5xx makes Razorpay retry the delivery.
        return res.status(500).json({ ok: false });
    }
});

router.use(requireAuth);

router.get('/config', (_req, res) => res.json(service.publicConfig()));

router.get('/workspaces', async (req, res) => {
    try {
        return res.json(await service.ownedStatus(String(req.user.sub)));
    } catch (err) { return fail(res, err, 'list workspaces'); }
});

router.get('/workspaces/:id', workspaceParam, async (req, res) => {
    try {
        return res.json(await service.workspaceStatus(req.params.id, String(req.user.sub)));
    } catch (err) { return fail(res, err, 'workspace status'); }
});

router.post('/workspaces/:id/checkout', workspaceParam, async (req, res) => {
    try {
        const userId = String(req.user.sub);
        const me = await repo.userPlanRow(userId);
        const body = req.body || {};
        const out = await service.startCheckout(req.params.id, { id: userId, email: me?.email || req.user.email },
            { cycle: String(body.cycle || ''), currency: String(body.currency || '').toUpperCase() });
        return res.status(201).json(out);
    } catch (err) { return fail(res, err, 'checkout'); }
});

router.post('/workspaces/:id/verify', workspaceParam, async (req, res) => {
    try {
        const b = req.body || {};
        return res.json(await service.verifyCheckout(req.params.id, String(req.user.sub), {
            paymentId: b.razorpay_payment_id, subscriptionId: b.razorpay_subscription_id, signature: b.razorpay_signature,
        }));
    } catch (err) { return fail(res, err, 'verify'); }
});

router.post('/workspaces/:id/cancel', workspaceParam, async (req, res) => {
    try {
        return res.json(await service.cancel(req.params.id, String(req.user.sub)));
    } catch (err) { return fail(res, err, 'cancel'); }
});

module.exports = router;
