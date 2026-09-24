const logger = require('../../../utils/logger');
const { Storage } = require('@google-cloud/storage');
const { randomUUID } = require('crypto');
const path = require('path');
const { pipeline } = require('stream');

const storageClient = new Storage({
    projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod',
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chttrix-uploads';

function resolveAttachmentType(mimeType = '') {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'voice';
    return 'file';
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {object} file   multer file
 * @param {string} folder GCS folder prefix
 * @param {object} [owner] { userId, companyId } — stored as object metadata and used for access checks
 */
async function uploadToGCS(file, folder = 'channels', owner = {}) {
    const ext = path.extname(file.originalname) || '';
    const date = new Date().toISOString().slice(0, 10); 
    const uniqueName = `${randomUUID()}${ext}`;
    const gcsPath = `${folder}/${date}/${uniqueName}`;

    const bucket = storageClient.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsPath);

    
    await new Promise((resolve, reject) => {
        const stream = gcsFile.createWriteStream({
            resumable: false,
            contentType: file.mimetype,
            metadata: {
                cacheControl: 'private, max-age=3600',
                originalName: file.originalname,
                ...(owner.userId ? { uploadedBy: String(owner.userId) } : {}),
                ...(owner.companyId ? { companyId: String(owner.companyId) } : {}),
            },
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(file.buffer);
    });

    
    
    
    
    const type = resolveAttachmentType(file.mimetype);

    return {
        url: `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`,
        name: file.originalname,
        size: file.size,
        sizeFormatted: formatSize(file.size),
        mimeType: file.mimetype,
        type,           
        gcsPath,        
    };
}

// Types that are safe to render inline in the browser. Everything else (HTML, SVG, XML,
// JS, unknown) is forced to download so a user-uploaded file can never execute script
// on our origin.
function isInlineSafe(mimeType) {
    const mt = String(mimeType || '').toLowerCase().split(';')[0].trim();
    if (mt === 'image/svg+xml') return false;
    return mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/') || mt === 'application/pdf';
}

const DANGEROUS_TYPES = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)/i;

function buildSafeHeaders(mimeType, originalName) {
    const inline = isInlineSafe(mimeType);
    const encodedName = encodeURIComponent(originalName).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return {
        'Content-Type': DANGEROUS_TYPES.test(mimeType) ? 'application/octet-stream' : mimeType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedName}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, max-age=3600',
    };
}

function pipeToResponse(readStream, res, label) {
    pipeline(readStream, res, (err) => {
        if (!err) return;
        // Client aborts surface as ERR_STREAM_PREMATURE_CLOSE — not worth an error log.
        if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error({ err }, `[UploadService] ${label} stream error`);
        }
        readStream.destroy();
        if (!res.destroyed) res.destroy();
    });
}

/**
 * Stream a GCS object to the client.
 * @param {object} [options]
 * @param {(objectMeta: object) => Promise<boolean>} [options.authorize] access check run after
 *        metadata is loaded; a falsy result yields 403 without streaming anything.
 */
async function streamGCSFile(gcsPath, req, res, options = {}) {
    const bucket = storageClient.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsPath);

    const [metadata] = await gcsFile.getMetadata();
    const objectMeta = metadata.metadata || {};

    if (typeof options.authorize === 'function') {
        const allowed = await options.authorize(objectMeta);
        if (!allowed) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }

    const mimeType = metadata.contentType || 'application/octet-stream';
    const fileSize = parseInt(metadata.size, 10);
    const originalName = objectMeta.originalName || path.basename(gcsPath);
    const safeHeaders = buildSafeHeaders(mimeType, originalName);

    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
        let start = match && match[1] !== '' ? parseInt(match[1], 10) : NaN;
        let end = match && match[2] !== '' ? parseInt(match[2], 10) : fileSize - 1;
        if (match && match[1] === '' && match[2] !== '') {
            // Suffix range: last N bytes
            start = Math.max(fileSize - parseInt(match[2], 10), 0);
            end = fileSize - 1;
        }
        if (!match || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }
        end = Math.min(end, fileSize - 1);

        res.writeHead(206, {
            ...safeHeaders,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
        });

        pipeToResponse(gcsFile.createReadStream({ start, end }), res, 'range');
    } else {
        res.writeHead(200, {
            ...safeHeaders,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
        });

        pipeToResponse(gcsFile.createReadStream(), res, 'full');
    }
}

module.exports = { uploadToGCS, streamGCSFile, BUCKET_NAME, isInlineSafe, buildSafeHeaders };
