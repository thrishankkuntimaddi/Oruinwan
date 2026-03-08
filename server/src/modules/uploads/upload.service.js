/**
 * upload.service.js — Phase 7.1 Attachments
 *
 * Streams a multer memory-buffer file into Google Cloud Storage.
 * Uses Application Default Credentials (ADC) — no JSON key file required.
 * On Cloud Run the service account chttrix-runtime@chttrix-prod-488612.iam.gserviceaccount.com
 * is automatically picked up by ADC.
 */

const { Storage } = require('@google-cloud/storage');
const { randomUUID } = require('crypto');
const path = require('path');


// ─── GCS client ──────────────────────────────────────────────────────────────
const storageClient = new Storage({
    projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod',
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chttrix-uploads';

// ─── MIME → attachment type map ───────────────────────────────────────────────
function resolveAttachmentType(mimeType = '') {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'voice';
    return 'file';
}

// ─── Format file size ─────────────────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Core upload function ─────────────────────────────────────────────────────
/**
 * Upload a multer in-memory file to GCS.
 *
 * @param {Express.Multer.File} file  — the multer file object (buffer in memory)
 * @param {string} folder             — top-level folder: 'channels', 'dms', 'voice'
 * @returns {Promise<object>}         — attachment metadata ready to attach to a message
 */
async function uploadToGCS(file, folder = 'channels') {
    const ext = path.extname(file.originalname) || '';
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const uniqueName = `${randomUUID()}${ext}`;
    const gcsPath = `${folder}/${date}/${uniqueName}`;

    const bucket = storageClient.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsPath);

    // Stream the buffer into GCS
    await new Promise((resolve, reject) => {
        const stream = gcsFile.createWriteStream({
            resumable: false,
            contentType: file.mimetype,
            metadata: {
                cacheControl: 'private, max-age=3600',
                originalName: file.originalname,
            },
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(file.buffer);
    });

    // NOTE: Bucket has Uniform Bucket-Level Access — cannot makePublic() per-object.
    // Files are served via the authenticated backend proxy:
    //   GET /api/v2/uploads/file?path=<gcsPath>
    // This keeps the bucket fully private while still serving files to authenticated users.
    const type = resolveAttachmentType(file.mimetype);

    return {
        url: `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`,
        name: file.originalname,
        size: file.size,
        sizeFormatted: formatSize(file.size),
        mimeType: file.mimetype,
        type,           // 'image' | 'video' | 'voice' | 'file'
        gcsPath,        // stored for re-proxying / future deletion
    };
}

// ─── Streaming proxy helper ───────────────────────────────────────────────────
/**
 * Stream a GCS object directly to an HTTP response.
 * Supports HTTP Range requests (RFC 7233) so HTML5 <audio>/<video> elements
 * can seek and play correctly. Without Range support browsers refuse to play.
 *
 * @param {string} gcsPath  — object path inside the bucket
 * @param {object} req      — Express request object (for Range header)
 * @param {object} res      — Express response object
 */
async function streamGCSFile(gcsPath, req, res) {
    const bucket = storageClient.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsPath);

    // Get metadata — needed for Content-Type, file size, and original filename
    const [metadata] = await gcsFile.getMetadata();
    const mimeType = metadata.contentType || 'application/octet-stream';
    const fileSize = parseInt(metadata.size, 10);
    const originalName = metadata.metadata?.originalName || path.basename(gcsPath);

    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
        // ── Partial content (Range request) — required for audio/video seeking ──
        const [, rangeStr] = rangeHeader.split('=');
        const [startStr, endStr] = rangeStr.split('-');
        const start = parseInt(startStr, 10) || 0;
        const end = endStr !== '' && endStr !== undefined ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            'Cache-Control': 'private, max-age=3600',
        });

        gcsFile.createReadStream({ start, end })
            .on('error', err => console.error('[UploadService] GCS range stream error:', err))
            .pipe(res);
    } else {
        // ── Full content response ─────────────────────────────────────────────
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes', // advertise Range support for future requests
            'Content-Disposition': `inline; filename="${encodeURIComponent(originalName)}"`,
            'Cache-Control': 'private, max-age=3600',
        });

        gcsFile.createReadStream()
            .on('error', err => {
                console.error('[UploadService] GCS stream error:', err);
                if (!res.headersSent) res.status(500).json({ error: 'Failed to stream file' });
            })
            .pipe(res);
    }
}

module.exports = { uploadToGCS, streamGCSFile, BUCKET_NAME };
