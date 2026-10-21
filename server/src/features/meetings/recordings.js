'use strict';

/**
 * Meeting / huddle recordings: multipart upload (one file, webm/mp4/m4a) to the
 * shared object storage (S3 or local disk, see modules/uploads/upload.service),
 * short-lived signed playback URLs, and deletion.
 *
 * Recording objects are not served by /api/v2/uploads/file (its access check knows
 * chat attachments, not meetings); each owner route streams them itself after
 * verifying the signature and re-checking access.
 */

const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const mongoose = require('mongoose');

const MAX_RECORDING_BYTES = Number(process.env.MAX_RECORDING_BYTES) || 500 * 1024 * 1024;
const MAX_DURATION_SEC = 24 * 3600;

const ALLOWED = {
    '.webm': ['video/webm', 'audio/webm'],
    '.mp4': ['video/mp4', 'audio/mp4'],
    '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'],
};
const DEFAULT_MIME = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.m4a': 'audio/mp4' };

const recordingSchema = new mongoose.Schema({
    path: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    durationSec: { type: Number, default: null },
    originalName: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const lazy = {
    storage: () => require('../../modules/uploads/upload.service'),
    signature: () => require('../../modules/uploads/mediaSignature'),
};

/** Returns the normalised mime type for an allowed recording, else null. */
function recordingType(file) {
    const ext = path.extname(String(file?.originalname || '')).toLowerCase();
    const allowed = ALLOWED[ext];
    if (!allowed) return null;
    const mime = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (allowed.includes(mime)) return mime;
    // Some recorders send application/octet-stream; trust the extension then.
    if (!mime || mime === 'application/octet-stream') return DEFAULT_MIME[ext];
    return null;
}

const multerRecording = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RECORDING_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!recordingType(file)) {
            return cb(Object.assign(new Error('Recordings must be .webm, .mp4 or .m4a audio/video'), { code: 'RECORDING_TYPE' }));
        }
        cb(null, true);
    },
});

/** Express middleware: parses the `file` field and answers multer errors with a clear 4xx. */
function uploadRecordingMiddleware(req, res, next) {
    multerRecording.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: `Recording too large (max ${Math.round(MAX_RECORDING_BYTES / (1024 * 1024))} MB)`, code: 'FILE_TOO_LARGE', maxBytes: MAX_RECORDING_BYTES });
        }
        if (err.code === 'RECORDING_TYPE') return res.status(415).json({ message: err.message, code: 'RECORDING_TYPE' });
        return res.status(400).json({ message: err.message || 'Invalid upload' });
    });
}

/** Parse an optional duration (seconds) from the form body. Returns { value } or { error }. */
function parseDuration(raw) {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_DURATION_SEC) return { error: `durationSec must be between 0 and ${MAX_DURATION_SEC}` };
    return { value: Math.round(n) };
}

/** Store the uploaded recording; returns the sub-document to save on the meeting/session. */
async function storeRecording(file, { workspaceId, ownerKey, userId, durationSec = null }) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = recordingType(file);
    const objectPath = `recordings/${workspaceId}/${ownerKey}/${randomUUID()}${ext}`;
    await lazy.storage().writeObject(objectPath, file.buffer, {
        contentType: mimeType,
        metadata: { originalName: file.originalname, uploadedBy: String(userId), workspaceId: String(workspaceId), kind: 'recording' },
    });
    return {
        path: objectPath,
        mimeType,
        size: file.size,
        durationSec,
        originalName: file.originalname,
        uploadedBy: userId,
        uploadedAt: new Date(),
    };
}

async function deleteRecordingObject(objectPath) {
    if (!objectPath) return;
    await lazy.storage().deleteObject(objectPath);
}

/** A signed playback URL on the owner's stream route: `${streamPath}?u=&exp=&sig=`. */
function signedRecordingUrl(streamPath, recording, userId, extraQuery = '') {
    const { url, expiresAt } = lazy.signature().signMediaPath(recording.path, userId);
    const query = url.slice(url.indexOf('?') + 1).split('&').filter((kv) => !kv.startsWith('path=')).join('&');
    return { url: `${streamPath}?${extraQuery ? `${extraQuery}&` : ''}${query}`, expiresAt };
}

/** The user id behind a valid signature for this recording, else null. */
function verifyRecordingSignature(recording, query) {
    if (!recording?.path) return null;
    return lazy.signature().verifyMediaSignature({ path: recording.path, u: query.u, exp: query.exp, sig: query.sig });
}

function streamRecording(recording, req, res) {
    return lazy.storage().streamObject(recording.path, req, res);
}

/** Public description of a stored recording (no object key). */
function describeRecording(recording) {
    if (!recording?.path) return null;
    return {
        mimeType: recording.mimeType,
        size: recording.size,
        durationSec: recording.durationSec ?? null,
        originalName: recording.originalName || '',
        uploadedBy: recording.uploadedBy ? String(recording.uploadedBy) : null,
        uploadedAt: recording.uploadedAt,
    };
}

module.exports = {
    recordingSchema,
    recordingType,
    uploadRecordingMiddleware,
    parseDuration,
    storeRecording,
    deleteRecordingObject,
    signedRecordingUrl,
    verifyRecordingSignature,
    streamRecording,
    describeRecording,
    MAX_RECORDING_BYTES,
    _lazy: lazy,
};
