'use strict';

/**
 * Developer-submitted marketplace apps (mounted under /api/developer, after requireAuth).
 *
 *   GET    /my-apps                      apps I own (with signing secret)
 *   POST   /my-apps                      create a draft
 *   PATCH  /my-apps/:id                  edit (draft/rejected; approved → back to review)
 *   POST   /my-apps/:id/submit           draft|rejected → submitted
 *   POST   /my-apps/:id/withdraw         submitted → draft
 *   POST   /my-apps/:id/rotate-secret    new webhook signing secret
 *   DELETE /my-apps/:id                  delete; revokes every install's tokens
 *
 *   GET    /admin/apps?status=           platform admin review queue (default: submitted)
 *   POST   /admin/apps/:id/review        { decision: 'approve'|'reject', note }
 */

const express = require('express');
const crypto = require('crypto');
const App = require('./app.model');
const { APP_CATEGORIES, APP_SCOPES, APP_STATUSES } = require('./app.model');
const { revokeAppTokens } = require('./appInstall.service');
const { requirePlatformAdmin } = require('./platformAdmin.middleware');
const { hydrate, userSelect } = require('../../identity/hydrate');
const { isValidId } = require('../../shared/utils/workspaceAccess');
const logger = require('../../../utils/logger');

const router = express.Router();

const OWNER_FIELDS = 'name description category iconUrl developer version status homepageUrl webhookUrl redirectUrl scopes botUser submittedAt review installedIn createdAt updatedAt +signingSecret';

const newSecret = () => 'whsec_' + crypto.randomBytes(24).toString('hex');

function bad(res, message) { return res.status(400).json({ message }); }

function checkUrl(v, field) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || v.length > 500) return `${field} must be a URL of at most 500 characters`;
    let u;
    try { u = new URL(v); } catch { return `${field} must be a valid URL`; }
    if (!['https:', 'http:'].includes(u.protocol)) return `${field} must be an http(s) URL`;
    if (u.username || u.password) return `${field} must not contain credentials`;
    return null;
}

/** Validate and normalise an app body. partial=true for PATCH. Returns { error } or { data }. */
function validateApp(body = {}, { partial = false } = {}) {
    const data = {};
    const has = (k) => body[k] !== undefined;

    if (!partial || has('name')) {
        if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 60) {
            return { error: 'name must be 2–60 characters' };
        }
        data.name = body.name.trim();
    }
    if (!partial || has('description')) {
        if (typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.trim().length > 1000) {
            return { error: 'description must be 10–1000 characters' };
        }
        data.description = body.description.trim();
    }
    if (has('category')) {
        if (!APP_CATEGORIES.includes(body.category)) return { error: `category must be one of: ${APP_CATEGORIES.join(', ')}` };
        data.category = body.category;
    }
    for (const [k, label] of [['iconUrl', 'iconUrl'], ['homepageUrl', 'homepageUrl'], ['webhookUrl', 'webhookUrl'], ['redirectUrl', 'redirectUrl']]) {
        if (!has(k)) continue;
        const e = checkUrl(body[k], label);
        if (e) return { error: e };
        data[k] = body[k] ? body[k] : null;
    }
    if (has('iconUrl') && data.iconUrl && !data.iconUrl.startsWith('https://')) return { error: 'iconUrl must be an https URL' };
    if (has('scopes')) {
        if (!Array.isArray(body.scopes) || !body.scopes.every((s) => APP_SCOPES.includes(s))) {
            return { error: `scopes must be an array of: ${APP_SCOPES.join(', ')}` };
        }
        data.scopes = [...new Set(body.scopes)];
    }
    if (has('botUser')) {
        const b = body.botUser;
        if (b === null || b === false) data.botUser = { enabled: false, name: null };
        else {
            if (typeof b !== 'object' || Array.isArray(b)) return { error: 'botUser must be { enabled, name }' };
            if (b.name !== undefined && b.name !== null && (typeof b.name !== 'string' || b.name.trim().length > 80)) {
                return { error: 'botUser.name must be at most 80 characters' };
            }
            data.botUser = { enabled: !!b.enabled, name: b.name ? b.name.trim() : null };
        }
    }
    if (has('version')) {
        if (typeof body.version !== 'string' || !/^\d+\.\d+\.\d+([-+][\w.]+)?$/.test(body.version) || body.version.length > 30) {
            return { error: 'version must look like 1.2.3' };
        }
        data.version = body.version;
    }
    if (has('developer')) {
        if (typeof body.developer !== 'string' || !body.developer.trim() || body.developer.trim().length > 80) {
            return { error: 'developer must be 1–80 characters' };
        }
        data.developer = body.developer.trim();
    }
    return { data };
}

function toOwnerView(app) {
    const a = app.toObject ? app.toObject() : app;
    // eslint-disable-next-line no-unused-vars
    const { installedIn, ...rest } = a;
    return { ...rest, installCount: (installedIn || []).length };
}

async function loadOwnApp(req, res) {
    if (!isValidId(req.params.id)) { bad(res, 'Invalid app id'); return null; }
    const app = await App.findById(req.params.id).select(OWNER_FIELDS + ' ownerId');
    if (!app || !app.ownerId || String(app.ownerId) !== String(req.user.sub)) {
        res.status(404).json({ message: 'App not found' });
        return null;
    }
    return app;
}

function isDuplicate(err) { return err && (err.code === 11000 || /duplicate key/i.test(err.message || '')); }

router.get('/my-apps', async (req, res) => {
    try {
        const apps = await App.find({ ownerId: req.user.sub }).select(OWNER_FIELDS).sort({ updatedAt: -1 }).lean();
        res.json({ apps: apps.map(toOwnerView), scopes: APP_SCOPES, categories: APP_CATEGORIES });
    } catch (err) {
        logger.error('[MyApps] GET error:', err.message);
        res.status(500).json({ message: 'Failed to load your apps' });
    }
});

router.post('/my-apps', async (req, res) => {
    try {
        const { error, data } = validateApp(req.body);
        if (error) return bad(res, error);
        const count = await App.countDocuments({ ownerId: req.user.sub });
        if (count >= 25) return res.status(409).json({ message: 'You can own at most 25 apps' });
        if (!data.developer) {
            const { users } = require('../../identity');
            const u = await users.findById(req.user.sub).catch(() => null);
            data.developer = (u && (u.profile?.name || u.username)) || 'Independent developer';
        }
        const app = await App.create({
            ...data,
            status: 'draft',
            isPublished: true,
            ownerId: req.user.sub,
            signingSecret: newSecret(),
            installedIn: [],
        });
        const fresh = await App.findById(app._id).select(OWNER_FIELDS).lean();
        res.status(201).json({ app: toOwnerView(fresh) });
    } catch (err) {
        if (isDuplicate(err)) return res.status(409).json({ message: 'An app with this name already exists' });
        logger.error('[MyApps] POST error:', err.message);
        res.status(500).json({ message: 'Failed to create app' });
    }
});

router.patch('/my-apps/:id', async (req, res) => {
    try {
        const app = await loadOwnApp(req, res);
        if (!app) return;
        if (app.status === 'submitted') {
            return res.status(409).json({ message: 'This app is waiting for review. Withdraw the submission to edit it.' });
        }
        const { error, data } = validateApp(req.body, { partial: true });
        if (error) return bad(res, error);
        Object.assign(app, data);
        let message = 'App updated';
        if (app.status === 'approved') {
            // Changes to a listed app are reviewed again; existing installs keep working.
            app.status = 'submitted';
            app.submittedAt = new Date();
            message = 'App updated and sent for review again. It is hidden from the marketplace until approved; existing installs keep working.';
        }
        await app.save();
        res.json({ message, app: toOwnerView(app) });
    } catch (err) {
        if (isDuplicate(err)) return res.status(409).json({ message: 'An app with this name already exists' });
        logger.error('[MyApps] PATCH error:', err.message);
        res.status(500).json({ message: 'Failed to update app' });
    }
});

router.post('/my-apps/:id/submit', async (req, res) => {
    try {
        const app = await loadOwnApp(req, res);
        if (!app) return;
        if (!['draft', 'rejected'].includes(app.status)) {
            return res.status(409).json({ message: `An app that is ${app.status} cannot be submitted` });
        }
        if ((app.scopes || []).length && !app.webhookUrl && !app.redirectUrl) {
            return bad(res, 'An app that asks for scopes needs a webhook URL or a redirect URL so it can receive its token');
        }
        app.status = 'submitted';
        app.submittedAt = new Date();
        await app.save();
        res.json({ message: 'Submitted for review', app: toOwnerView(app) });
    } catch (err) {
        logger.error('[MyApps] submit error:', err.message);
        res.status(500).json({ message: 'Failed to submit app' });
    }
});

router.post('/my-apps/:id/withdraw', async (req, res) => {
    try {
        const app = await loadOwnApp(req, res);
        if (!app) return;
        if (app.status !== 'submitted') return res.status(409).json({ message: 'Only a submitted app can be withdrawn' });
        app.status = 'draft';
        await app.save();
        res.json({ message: 'Submission withdrawn', app: toOwnerView(app) });
    } catch (err) {
        logger.error('[MyApps] withdraw error:', err.message);
        res.status(500).json({ message: 'Failed to withdraw app' });
    }
});

router.post('/my-apps/:id/rotate-secret', async (req, res) => {
    try {
        const app = await loadOwnApp(req, res);
        if (!app) return;
        app.signingSecret = newSecret();
        await app.save();
        res.json({ message: 'Signing secret rotated', signingSecret: app.signingSecret });
    } catch (err) {
        logger.error('[MyApps] rotate error:', err.message);
        res.status(500).json({ message: 'Failed to rotate secret' });
    }
});

router.delete('/my-apps/:id', async (req, res) => {
    try {
        const app = await loadOwnApp(req, res);
        if (!app) return;
        const revoked = await revokeAppTokens(app._id, null);
        await App.deleteOne({ _id: app._id });
        try { await require('../community/AppReview.model').deleteMany({ appId: app._id }); } catch { /* reviews optional */ }
        res.json({ message: 'App deleted', ...revoked });
    } catch (err) {
        logger.error('[MyApps] DELETE error:', err.message);
        res.status(500).json({ message: 'Failed to delete app' });
    }
});

// ── Platform admin review queue ─────────────────────────────────────────────

router.get('/admin/apps', requirePlatformAdmin, async (req, res) => {
    try {
        const status = req.query.status || 'submitted';
        if (status !== 'all' && !APP_STATUSES.includes(status)) return bad(res, 'Invalid status');
        const q = status === 'all' ? { ownerId: { $ne: null } } : { status, ownerId: { $ne: null } };
        const apps = await App.find(q)
            .select('name description category iconUrl developer version status homepageUrl webhookUrl redirectUrl scopes botUser submittedAt review installedIn ownerId createdAt updatedAt')
            .sort({ submittedAt: 1, createdAt: 1 })
            .limit(200)
            .lean()
            .then((rows) => hydrate(rows, { ownerId: userSelect('username email') }));
        const counts = await App.aggregate([{ $match: { ownerId: { $ne: null } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
        res.json({
            apps: apps.map(toOwnerView),
            counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
        });
    } catch (err) {
        logger.error('[AppReview] list error:', err.message);
        res.status(500).json({ message: 'Failed to load the review queue' });
    }
});

router.post('/admin/apps/:id/review', requirePlatformAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return bad(res, 'Invalid app id');
        const { decision } = req.body || {};
        const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
        if (!['approve', 'reject'].includes(decision)) return bad(res, "decision must be 'approve' or 'reject'");
        if (decision === 'reject' && !note) return bad(res, 'Give the developer a reason when rejecting');

        const app = await App.findById(req.params.id).select('name status ownerId installedIn');
        if (!app || !app.ownerId) return res.status(404).json({ message: 'App not found' });

        let takedown = null;
        if (decision === 'approve') {
            if (app.status !== 'submitted') return res.status(409).json({ message: 'Only submitted apps can be approved' });
            app.status = 'approved';
        } else {
            if (!['submitted', 'approved'].includes(app.status)) return res.status(409).json({ message: `A ${app.status} app cannot be rejected` });
            if (app.status === 'approved' || (app.installedIn || []).length) {
                // Taking a listed app down uninstalls it everywhere and revokes its tokens.
                takedown = await revokeAppTokens(app._id, null);
                app.installedIn = [];
            }
            app.status = 'rejected';
        }
        app.review = { note: note || null, reviewedBy: req.user.sub, reviewedAt: new Date() };
        await app.save();

        notifyOwner(app, decision, note).catch(() => {});
        res.json({ message: decision === 'approve' ? 'App approved' : 'App rejected', status: app.status, ...(takedown || {}) });
    } catch (err) {
        logger.error('[AppReview] review error:', err.message);
        res.status(500).json({ message: 'Failed to review app' });
    }
});

/** Email the developer about the review outcome (best effort, plain text, no secrets). */
async function notifyOwner(app, decision, note) {
    const { users } = require('../../identity');
    const owner = await users.findById(app.ownerId);
    if (!owner || !owner.email) return;
    const sendEmail = require('../../../utils/sendEmail');
    const approved = decision === 'approve';
    const subject = approved ? `${app.name} is now in the Oruinwan marketplace` : `${app.name} was not approved`;
    const text = approved
        ? `Your app "${app.name}" was approved and is now listed in the marketplace.`
        : `Your app "${app.name}" was not approved.\n\nReviewer note: ${note || '(none)'}\n\nYou can edit it and submit it again from the Developer portal (My apps).`;
    await sendEmail({ to: owner.email, subject, text, html: `<p>${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).replace(/\n/g, '<br>')}</p>` });
}

module.exports = router;
module.exports.validateApp = validateApp;
