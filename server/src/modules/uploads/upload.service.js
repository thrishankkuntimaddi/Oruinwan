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
// ADC: on Cloud Run the SA is injected automatically.
// Locally, run: gcloud auth application-default login
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
                cacheControl: 'public, max-age=31536000',
                originalName: file.originalname,
            },
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(file.buffer);
    });

    // NOTE: bucket has Uniform Bucket-Level Access enabled — do NOT call makePublic().
    // Public read access is granted at the bucket level via IAM (allUsers → Storage Object Viewer).
    // The public URL is deterministic from the bucket name + object path.
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;
    const type = resolveAttachmentType(file.mimetype);

    return {
        url: publicUrl,
        name: file.originalname,
        size: file.size,
        sizeFormatted: formatSize(file.size),
        mimeType: file.mimetype,
        type,           // 'image' | 'video' | 'voice' | 'file'
        gcsPath,        // stored for potential future deletion
    };
}

module.exports = { uploadToGCS };
