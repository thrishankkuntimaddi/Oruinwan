'use strict';

const express = require('express');
const multer = require('multer');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger = require('../../../utils/logger');
const requireAuth = require('../../shared/middleware/auth');
const service = require('./stickers.service');
const giphy = require('./giphy');
const { fixFilenameEncoding } = require('../../modules/uploads/upload.controller');

const router = express.Router();

const giphyLimiter = rateLimit({
    windowMs: 60_000,
    max: 90,
    keyGenerator: (req) => req.user?.sub ?? ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many GIF searches, slow down a little.' },
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: service.MAX_STICKER_BYTES, files: 1 },
});

function sendError(res, err, label) {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Stickers can be up to 5 MB', code: 'STICKER_TOO_LARGE' });
    const status = Number(err?.status) || 500;
    if (status >= 500 && status !== 502 && status !== 503) logger.error({ err }, `[Stickers] ${label} failed`);
    return res.status(status).json({ message: status >= 500 && status !== 502 && status !== 503 ? 'Something went wrong with stickers' : err.message, code: err?.code });
}

/** The library, and whether GIF search is available here. */
router.get('/', requireAuth, async (req, res) => {
    try {
        res.json({ stickers: await service.list(req.user.sub), giphy: giphy.enabled() });
    } catch (err) {
        sendError(res, err, 'list');
    }
});

/** Save a picture from a conversation (by its stored URL). */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { url, pack, width, height } = req.body || {};
        const { sticker, existed } = await service.addFromUrl(req.user.sub, { url, pack, width, height });
        res.status(existed ? 200 : 201).json({ sticker, existed });
    } catch (err) {
        sendError(res, err, 'save');
    }
});

/** Add a picture from this device: one made from a photo, or a PNG/WebP/GIF as is. */
router.post('/upload', requireAuth, (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
        try {
            if (uploadErr) throw uploadErr;
            if (req.file) req.file.originalname = fixFilenameEncoding(req.file.originalname);
            const { pack, width, height, made } = req.body || {};
            const sticker = await service.addFile(req.user.sub, req.file, { pack, width, height, made: made === 'true' || made === true });
            res.status(201).json({ sticker });
        } catch (err) {
            sendError(res, err, 'upload');
        }
    });
});

router.patch('/packs', requireAuth, async (req, res) => {
    try {
        const { from, to } = req.body || {};
        res.json({ updated: await service.renamePack(req.user.sub, from, to) });
    } catch (err) {
        sendError(res, err, 'rename pack');
    }
});

router.delete('/packs', requireAuth, async (req, res) => {
    try {
        res.json({ removed: await service.removePack(req.user.sub, req.query.name) });
    } catch (err) {
        sendError(res, err, 'remove pack');
    }
});

/** GIPHY search (trending when q is empty). kind: gifs | stickers. */
router.get('/giphy', requireAuth, giphyLimiter, async (req, res) => {
    try {
        if (!giphy.enabled()) return res.status(503).json({ message: 'GIF search is not set up on this server', code: 'GIPHY_OFF' });
        const { q, kind, offset } = req.query;
        return res.json(await giphy.search({ q, kind, offset }));
    } catch (err) {
        return sendError(res, err, 'giphy search');
    }
});

/** A GIPHY result, copied here so it can be sent; save: true also adds it to the library. */
router.post('/giphy', requireAuth, giphyLimiter, async (req, res) => {
    try {
        const { id, kind, save, pack } = req.body || {};
        res.status(201).json(await service.fromGiphy(req.user.sub, { id, kind, save: !!save, pack }));
    } catch (err) {
        sendError(res, err, 'giphy send');
    }
});

router.patch('/:id', requireAuth, async (req, res) => {
    try {
        res.json({ sticker: await service.update(req.user.sub, req.params.id, req.body || {}) });
    } catch (err) {
        sendError(res, err, 'update');
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await service.remove(req.user.sub, req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, 'remove');
    }
});

module.exports = router;
