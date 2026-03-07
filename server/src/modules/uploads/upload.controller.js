/**
 * upload.controller.js — Phase 7.1 Attachments
 *
 * POST /api/v2/uploads
 * Accepts a single multipart file field named "file".
 * Returns attachment metadata that the client uses to craft the message body.
 */

const multer = require('multer');
const { uploadToGCS } = require('./upload.service');

// ─── Multer — memory storage (no disk writes) ─────────────────────────────────
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        // Reject executable-like files for basic protection
        const blocked = [
            'application/x-msdownload',
            'application/x-executable',
            'application/x-sh',
            'application/bat',
        ];
        if (blocked.includes(file.mimetype)) {
            return cb(new Error('File type not allowed'));
        }
        cb(null, true);
    },
});

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/v2/uploads
 * Body (multipart/form-data):
 *   file              — the file binary
 *   conversationType  — 'channel' | 'dm'   (determines GCS folder)
 *   conversationId    — channel / DM session ID  (for logging / future ACL)
 */
async function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { conversationType = 'channel' } = req.body;

        // Map conversationType → GCS folder prefix
        let folder;
        if (req.file.mimetype.startsWith('audio/')) {
            folder = 'voice';
        } else if (conversationType === 'dm') {
            folder = 'dms';
        } else {
            folder = 'channels';
        }

        const attachment = await uploadToGCS(req.file, folder);

        return res.status(200).json(attachment);
    } catch (err) {
        console.error('[UploadController] uploadFile error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large (max 100 MB)' });
        }
        return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
}

module.exports = {
    upload,       // multer middleware — used in routes
    uploadFile,   // request handler
};
