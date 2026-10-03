const logger = require('../../../utils/logger');
const { randomUUID } = require('crypto');
const path = require('path');
const { pipeline } = require('stream');
const fs = require('fs');

/**
 * Where uploaded objects live. The S3 driver speaks to the compose s3 service (RustFS)
 * locally and to any
 * S3-compatible service later (same code, different S3_ENDPOINT). It is chosen
 * when S3_ENDPOINT or S3_BUCKET is set (or STORAGE_DRIVER=s3); otherwise objects
 * go to local disk (LOCAL_UPLOAD_DIR), which is for development and tests only:
 * a second server instance cannot see files written by the first.
 */
function storageDriver(env = process.env) {
    if (env.STORAGE_DRIVER === 's3' || env.STORAGE_DRIVER === 'local') return env.STORAGE_DRIVER;
    return env.S3_ENDPOINT || env.S3_BUCKET ? 's3' : 'local';
}

const BUCKET_NAME = process.env.S3_BUCKET || 'oruinwan-uploads';

let s3Client = null;
function s3() {
    if (!s3Client) {
        const { S3Client } = require('@aws-sdk/client-s3');
        const env = process.env;
        s3Client = new S3Client({
            region: env.S3_REGION || 'us-east-1',
            endpoint: env.S3_ENDPOINT || undefined,
            // Self-hosted S3 servers serve buckets as a path (host/bucket), not as a subdomain.
            forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
            credentials: env.S3_ACCESS_KEY && env.S3_SECRET_KEY
                ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
                : undefined,
        });
    }
    return s3Client;
}

const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'uploads', 'objects');

if (storageDriver() === 'local') {
    const note = `[UploadService] Storing uploads on local disk at ${LOCAL_UPLOAD_DIR} (no S3 configured).`;
    if (process.env.NODE_ENV === 'production') logger.warn(`${note} Files will not survive a redeploy and are not shared between instances; set S3_ENDPOINT/S3_BUCKET.`);
    else logger.info(note);
}

function localPath(objectPath) {
    const full = path.resolve(LOCAL_UPLOAD_DIR, objectPath);
    if (!full.startsWith(path.resolve(LOCAL_UPLOAD_DIR) + path.sep)) throw Object.assign(new Error('Invalid path'), { code: 400 });
    return full;
}

const isNotFound = (err) => err && (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404);

// S3 lowercases user-metadata keys (x-amz-meta-*), so `uploadedBy` comes back as
// `uploadedby`. Map them back to the camelCase names the access checks read.
const METADATA_KEYS = ['originalName', 'uploadedBy', 'companyId', 'workspaceId', 'kind'];
function fromS3Metadata(meta = {}) {
    const out = {};
    for (const [k, v] of Object.entries(meta || {})) {
        const known = METADATA_KEYS.find((name) => name.toLowerCase() === k.toLowerCase());
        out[known || k] = v;
    }
    return out;
}

/** A handle (getMetadata / createReadStream) for either driver; the shape is shared by both. */
function objectHandle(objectPath) {
    if (storageDriver() === 's3') {
        return {
            async getMetadata() {
                const { HeadObjectCommand } = require('@aws-sdk/client-s3');
                let head;
                try {
                    head = await s3().send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: objectPath }));
                } catch (err) {
                    if (isNotFound(err)) throw Object.assign(new Error('File not found'), { code: 404 });
                    throw err;
                }
                return [{ contentType: head.ContentType, size: head.ContentLength, metadata: fromS3Metadata(head.Metadata) }];
            },
            // Lazy stream: the GetObject round trip happens once a consumer attaches.
            createReadStream(opts = {}) {
                const { GetObjectCommand } = require('@aws-sdk/client-s3');
                const { PassThrough } = require('stream');
                const out = new PassThrough();
                const range = opts.start != null ? `bytes=${opts.start}-${opts.end != null ? opts.end : ''}` : undefined;
                s3().send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectPath, Range: range }))
                    .then((res) => { res.Body.on('error', (e) => out.destroy(e)); res.Body.pipe(out); })
                    .catch((err) => out.destroy(isNotFound(err) ? Object.assign(new Error('File not found'), { code: 404 }) : err));
                return out;
            },
        };
    }
    const full = localPath(objectPath);
    return {
        async getMetadata() {
            let meta;
            try {
                meta = JSON.parse(await fs.promises.readFile(`${full}.meta.json`, 'utf8'));
            } catch {
                throw Object.assign(new Error('File not found'), { code: 404 });
            }
            const { size } = await fs.promises.stat(full);
            return [{ contentType: meta.contentType, size, metadata: meta.metadata || {} }];
        },
        createReadStream(opts = {}) {
            return fs.createReadStream(full, opts.start != null ? { start: opts.start, end: opts.end } : undefined);
        },
    };
}

async function writeObject(objectPath, buffer, { contentType, metadata }) {
    if (storageDriver() === 's3') {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        // S3 user metadata is string-only; drop empty values so the header set stays clean.
        const Metadata = Object.fromEntries(Object.entries(metadata || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]));
        await s3().send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectPath,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'private, max-age=3600',
            Metadata,
        }));
        return;
    }
    const full = localPath(objectPath);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
    await fs.promises.writeFile(`${full}.meta.json`, JSON.stringify({ contentType, metadata }));
}

// Image formats most browsers cannot draw in an <img> (HEIC/HEIF from iPhones, TIFF),
// or that are never served inline (SVG can carry script): shared as files instead.
const NON_DISPLAYABLE_IMAGES = /^image\/(heic|heif|heic-sequence|heif-sequence|tiff|svg\+xml|x-icon|vnd\.)/i;

function resolveAttachmentType(mimeType = '') {
    mimeType = String(mimeType || '').toLowerCase();
    if (mimeType.startsWith('image/')) return NON_DISPLAYABLE_IMAGES.test(mimeType) ? 'file' : 'image';
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
 * Store a multer file under <folder>/<date>/<uuid><ext>.
 * @param {object} file   multer file
 * @param {string} folder object key prefix
 * @param {object} [owner] { userId, companyId } — stored as object metadata and used for access checks
 */
async function uploadObject(file, folder = 'channels', owner = {}) {
    const ext = path.extname(file.originalname) || '';
    const date = new Date().toISOString().slice(0, 10); 
    const uniqueName = `${randomUUID()}${ext}`;
    const gcsPath = `${folder}/${date}/${uniqueName}`;

    await writeObject(gcsPath, file.buffer, {
        contentType: file.mimetype,
        metadata: {
            originalName: file.originalname,
            ...(owner.userId ? { uploadedBy: String(owner.userId) } : {}),
            ...(owner.companyId ? { companyId: String(owner.companyId) } : {}),
        },
    });

    const type = resolveAttachmentType(file.mimetype);

    return {
        url: `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`,
        name: file.originalname,
        size: file.size,
        sizeFormatted: formatSize(file.size),
        mimeType: file.mimetype,
        type,
        gcsPath, // object key; the name is kept because models and access checks query this field
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
        // The web app may run on another origin than the API; files are protected by
        // auth or a signed link, so let the app embed them in <img>/<video>/<audio>.
        'Cross-Origin-Resource-Policy': 'cross-origin',
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
 * Stream a stored object to the client (with HTTP range support).
 * @param {object} [options]
 * @param {(objectMeta: object) => Promise<boolean>} [options.authorize] access check run after
 *        metadata is loaded; a falsy result yields 403 without streaming anything.
 */
async function streamObject(gcsPath, req, res, options = {}) {
    const gcsFile = objectHandle(gcsPath);

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

/** Delete a stored object (and its local .meta.json). Missing objects are ignored. */
async function deleteObject(objectPath) {
    if (storageDriver() === 's3') {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        try {
            await s3().send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: objectPath }));
        } catch (err) {
            if (!isNotFound(err)) throw err;
        }
        return;
    }
    const full = localPath(objectPath);
    await fs.promises.rm(full, { force: true });
    await fs.promises.rm(`${full}.meta.json`, { force: true });
}

/** Test hook: swap the S3 client. */
function _setS3ClientForTests(client) { s3Client = client; }

/**
 * Create the bucket if it does not exist (S3 driver only). Called once at boot;
 * a storage error here is logged, not fatal, so the API still starts.
 */
async function ensureBucket() {
    if (storageDriver() !== 's3') return { driver: 'local' };
    const { HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
    try {
        await s3().send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        return { driver: 's3', bucket: BUCKET_NAME, created: false };
    } catch (err) {
        if (!isNotFound(err)) {
            logger.error(`[UploadService] Object storage unreachable (${err.name || err.message}); uploads will fail until S3_ENDPOINT answers`);
            return { driver: 's3', bucket: BUCKET_NAME, error: err.message };
        }
    }
    try {
        await s3().send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        logger.info(`[UploadService] Created bucket "${BUCKET_NAME}"`);
        return { driver: 's3', bucket: BUCKET_NAME, created: true };
    } catch (err) {
        if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') return { driver: 's3', bucket: BUCKET_NAME, created: false };
        logger.error(`[UploadService] Could not create bucket "${BUCKET_NAME}": ${err.message}`);
        return { driver: 's3', bucket: BUCKET_NAME, error: err.message };
    }
}

module.exports = {
    ensureBucket,
    fromS3Metadata,
    uploadObject, streamObject, deleteObject, writeObject, objectHandle,
    // Older names, kept for the existing call sites.
    uploadToGCS: uploadObject, streamGCSFile: streamObject,
    resolveAttachmentType, BUCKET_NAME, isInlineSafe, buildSafeHeaders, storageDriver, _setS3ClientForTests,
};
