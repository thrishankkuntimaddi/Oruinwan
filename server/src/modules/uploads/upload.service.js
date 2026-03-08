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
 * The backend acts as an authenticated proxy — the GCS bucket stays fully private.
 *
 * @param {string} gcsPath  — object path inside the bucket (e.g. channels/2026-03-08/uuid.pdf)
 * @param {object} res      — Express response object
 */
async function streamGCSFile(gcsPath, res) {
    const bucket = storageClient.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(gcsPath);

    // Verify the file exists and get metadata (for Content-Type / Content-Length)
    const [metadata] = await gcsFile.getMetadata();
    const mimeType = metadata.contentType || 'application/octet-stream';
    const fileSize = metadata.size;
    const originalName = metadata.metadata?.originalName || path.basename(gcsPath);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Pipe GCS read stream → HTTP response
    const readStream = gcsFile.createReadStream();
    readStream.on('error', (err) => {
        console.error('[UploadService] GCS stream error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream file' });
        }
    });
    readStream.pipe(res);
}

module.exports = { uploadToGCS, streamGCSFile, BUCKET_NAME };
