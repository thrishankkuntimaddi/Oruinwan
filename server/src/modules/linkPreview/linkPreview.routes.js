'use strict';

const express    = require('express');
const router     = express.Router();
const auth       = require('../../shared/middleware/auth');
const controller = require('./linkPreview.controller');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// 30 preview fetches per user per minute
const previewLimiter = rateLimit({
    windowMs: 60_000,
    max:      30,
    keyGenerator: (req) => req.user?.sub ?? ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders:   false,
    message: { message: 'Too many preview requests, slow down.' },
});

router.post('/', auth, previewLimiter, controller.getLinkPreview);

module.exports = router;
