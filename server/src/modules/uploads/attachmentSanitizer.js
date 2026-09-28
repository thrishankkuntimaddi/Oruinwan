'use strict';

/**
 * Attachments on a new message come from the client. Keep only known fields, and only
 * files served by /api/v2/uploads/file that the sender can read themselves: otherwise
 * a message could point at any stored object (and file access follows messages), or
 * carry arbitrary URLs and oversized fields.
 */

const { objectHandle } = require('./upload.service');
const { canAccessFile } = require('./upload.access');

const TYPES = new Set(['image', 'video', 'file', 'audio', 'voice']);
const VARIANTS = new Set(['video_note', 'screen_recording']);
const MAX_ATTACHMENTS = 10;
const PROXY_PREFIX = '/api/v2/uploads/file?path=';

class AttachmentError extends Error {
    constructor(message) {
        super(message);
        this.status = 400;
        this.code = 'INVALID_ATTACHMENT';
    }
}

function objectPathOf(url) {
    if (typeof url !== 'string' || !url.startsWith(PROXY_PREFIX)) return null;
    const encoded = url.slice(PROXY_PREFIX.length);
    if (encoded.includes('&') || encoded.includes('#')) return null;
    let p;
    try { p = decodeURIComponent(encoded); } catch { return null; }
    if (!/^[a-zA-Z0-9/_.\-]+$/.test(p) || p.includes('..')) return null;
    return p;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const num = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

function pickFields(a) {
    const out = {
        type: a.type,
        url: a.url,
        name: str(a.name, 255),
        size: num(a.size, 0, 10 * 1024 * 1024 * 1024),
        mimeType: str(a.mimeType, 127),
        duration: num(a.duration, 0, 24 * 60 * 60),
        width: num(a.width, 1, 100000),
        height: num(a.height, 1, 100000),
        variant: VARIANTS.has(a.variant) ? a.variant : undefined,
    };
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
}

/**
 * @returns {Promise<object[]>} cleaned attachments
 * @throws {AttachmentError} (status 400) or an access error (status 403)
 */
async function sanitizeAttachments(attachments, userId) {
    if (attachments == null) return [];
    if (!Array.isArray(attachments)) throw new AttachmentError('attachments must be an array');
    if (attachments.length > MAX_ATTACHMENTS) throw new AttachmentError(`At most ${MAX_ATTACHMENTS} attachments per message`);

    const out = [];
    for (const raw of attachments) {
        if (!raw || typeof raw !== 'object') throw new AttachmentError('Invalid attachment');
        if (!TYPES.has(raw.type)) throw new AttachmentError('Invalid attachment type');
        const objectPath = objectPathOf(raw.url);
        if (!objectPath) throw new AttachmentError('Attachments must be uploaded files');

        let meta;
        try {
            [meta] = await objectHandle(objectPath).getMetadata();
        } catch (err) {
            if (err && err.code === 404) throw new AttachmentError('Attached file not found');
            throw err;
        }
        const allowed = await canAccessFile(objectPath, userId, (meta && meta.metadata) || {});
        if (!allowed) {
            const e = new Error('You cannot share this file');
            e.status = 403;
            e.code = 'ATTACHMENT_FORBIDDEN';
            throw e;
        }
        const clean = pickFields(raw);
        // Size and type come from storage when known, not from the client.
        if (meta && meta.size != null && Number.isFinite(Number(meta.size))) clean.size = Number(meta.size);
        if (meta && meta.contentType && !clean.mimeType) clean.mimeType = meta.contentType;
        out.push(clean);
    }
    return out;
}

module.exports = { sanitizeAttachments, objectPathOf, AttachmentError, MAX_ATTACHMENTS };
