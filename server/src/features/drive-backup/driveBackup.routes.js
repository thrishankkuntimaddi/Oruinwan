'use strict';

/**
 * Google Drive backup API, mounted at /api/v2/backup (docs/api/backup.md).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../../../utils/logger');
const requireAuth = require('../../shared/middleware/auth');
const service = require('./driveBackup.service');

const router = express.Router();
const uid = (req) => req.user?.sub || req.user?.id;

const heavyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: process.env.NODE_ENV === 'production' ? 10 : 200,
    keyGenerator: (req) => `user:${uid(req)}`, // always after requireAuth
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: 'Too many backup requests. Try again in a few minutes.', code: 'RATE_LIMITED' }),
});

const send = (res, err) => {
    if ((err.status && err.status < 500) || err.status === 502 || err.status === 503) {
        return res.status(err.status).json({ message: err.message, code: err.code || null });
    }
    logger.error('[BACKUP] request failed:', err.message);
    return res.status(500).json({ message: 'Something went wrong with the backup. Try again.' });
};

const wrap = (fn) => async (req, res) => {
    try { return res.json(await fn(req, res)); } catch (err) { return send(res, err); }
};

// ── Google redirect (no session: identified by the one-time state) ───────────

function webAppUrl() { return require('../../shared/utils/webAppUrl').webAppUrl().replace(/\/+$/, ''); }
const APP_RETURN = () => {
    const configured = String(process.env.APP_BACKUP_RETURN_URL || '').trim();
    return /^[a-z][a-z0-9+.-]*:\/\/\S*$/i.test(configured) && !/^(https?|javascript|data|file):/i.test(configured) ? configured : 'oruinwan://backup';
};

const DONE_TEXT = {
    connected: ['Google Drive is connected', 'Your first backup starts now. You can close this window and go back to Oruinwan.'],
    found: ['Google Drive is connected', 'This Google account already has an Oruinwan backup. Go back to Oruinwan to restore it or replace it.'],
    denied: ['Google Drive was not connected', 'You cancelled on the Google page. You can close this window.'],
    scope_denied: ['Google Drive was not connected', 'Oruinwan needs permission to keep its backup in your Drive. Try again and leave that box ticked.'],
    expired: ['This link has expired', 'Start again from Settings → Backup in Oruinwan.'],
    failed: ['Google Drive was not connected', 'Something went wrong. Start again from Settings → Backup in Oruinwan.'],
};

function donePage(result) {
    const [title, body] = DONE_TEXT[result] || DONE_TEXT.failed;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,-apple-system,sans-serif;background:#f6f5f2;color:#1d1c1a}
main{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#5c5a55}
@media (prefers-color-scheme:dark){body{background:#151413;color:#f1efe9}p{color:#a9a69f}}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(body)}</p></main></body></html>`;
}

router.get('/google/callback', async (req, res) => {
    let out = { client: 'web', result: 'failed' };
    try {
        out = await service.finishConnect({ state: req.query.state, code: req.query.code, error: req.query.error });
    } catch (err) {
        logger.error('[BACKUP] connect callback failed:', err.message);
    }
    if (out.client === 'app') return res.redirect(`${APP_RETURN()}?result=${encodeURIComponent(out.result)}`);
    if (out.client === 'desktop') return res.type('html').send(donePage(out.result));
    return res.redirect(`${webAppUrl()}/settings?tab=backup&backup=${encodeURIComponent(out.result)}`);
});

// ── Signed-in API ────────────────────────────────────────────────────────────

router.use(requireAuth);

router.get('/status', wrap((req) => service.getStatus(uid(req), { offer: req.query.offer === '1' })));

router.post('/google/connect', heavyLimiter, wrap((req) => service.startConnect(uid(req), {
    client: String(req.body?.client || 'web'),
    loginHint: typeof req.body?.loginHint === 'string' ? req.body.loginHint.slice(0, 320) : undefined,
})));

router.post('/disconnect', wrap((req) => service.disconnect(uid(req), { deleteBackup: req.body?.deleteBackup === true })));

router.patch('/settings', wrap((req) => {
    if (typeof req.body?.autoBackup !== 'boolean') throw Object.assign(new Error('autoBackup must be true or false'), { status: 400 });
    return service.setAutoBackup(uid(req), req.body.autoBackup);
}));

router.post('/run', heavyLimiter, wrap((req) => service.backupNow(uid(req))));

router.get('/restore/preview', heavyLimiter, wrap((req) => service.previewRestore(uid(req))));

router.post('/restore', heavyLimiter, wrap((req) => {
    if (req.body?.confirm !== true) throw Object.assign(new Error('Preview the restore first, then confirm it'), { status: 400, code: 'CONFIRM_REQUIRED' });
    return service.applyRestore(uid(req));
}));

module.exports = router;
