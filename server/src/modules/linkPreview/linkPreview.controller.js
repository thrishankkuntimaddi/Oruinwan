/**
 * linkPreview.controller.js — Phase 7.5
 *
 * POST /api/v2/link-preview
 * Body: { url: string }
 * Response: { url, title, description, image, site }
 */

'use strict';

const { fetchLinkPreview } = require('./linkPreview.service');

exports.getLinkPreview = async (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'url is required' });
    }

    try {
        const preview = await fetchLinkPreview(url.trim());
        return res.json({ preview });
    } catch (err) {
        // Return a structured error so the client can silently skip the preview
        const isBlocked = err.message?.includes('Blocked') || err.message?.includes('private');
        return res.status(isBlocked ? 403 : 422).json({
            message: err.message || 'Could not fetch preview',
        });
    }
};
