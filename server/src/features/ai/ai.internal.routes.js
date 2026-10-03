'use strict';

/**
 * Internal endpoint for the standalone AI process (ai/server.js): it has no
 * database, so the assistant's tool actions run here.
 *
 *   POST /api/internal/ai-actions/:name   Authorization: Bearer <AI_SERVICE_TOKEN>
 *   { args, ctx: { userId, workspaceId } } -> { result }
 *
 * Only the functions exported by utils/aiActions.js are reachable, the user
 * and workspace ids come from the AI's run context (which the API set from
 * the authenticated request), and every action re-checks membership itself.
 * Disabled (503) unless AI_SERVICE_TOKEN is set.
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../../../utils/logger');
const aiActions = require('../../../utils/aiActions');
const { getIO } = require('../../socket/getIO');

const router = express.Router();

function tokenMatches(header, token) {
    if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
    const given = Buffer.from(header.slice(7));
    const want = Buffer.from(token);
    return given.length === want.length && crypto.timingSafeEqual(given, want);
}

router.use((req, res, next) => {
    const token = process.env.AI_SERVICE_TOKEN;
    if (!token) return res.status(503).json({ error: 'AI service integration is not configured (AI_SERVICE_TOKEN)' });
    if (!tokenMatches(req.headers.authorization, token)) return res.status(401).json({ error: 'Unauthorized' });
    next();
});

router.post('/:name', async (req, res) => {
    const name = String(req.params.name || '');
    const fn = Object.prototype.hasOwnProperty.call(aiActions, name) ? aiActions[name] : null;
    if (typeof fn !== 'function' || name.startsWith('_')) return res.status(404).json({ error: `Unknown action ${name}` });
    const { args = {}, ctx = {} } = req.body || {};
    if (!ctx.userId) return res.status(400).json({ error: 'ctx.userId is required' });
    try {
        const result = await fn(args, { userId: String(ctx.userId), workspaceId: ctx.workspaceId ? String(ctx.workspaceId) : null, io: getIO() });
        return res.json({ result });
    } catch (err) {
        logger.error({ err }, `[AI internal] action ${name} failed`);
        return res.status(500).json({ error: err.message || 'Action failed' });
    }
});

module.exports = router;
module.exports.tokenMatches = tokenMatches;
