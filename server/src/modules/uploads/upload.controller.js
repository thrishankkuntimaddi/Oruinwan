const logger = require('../../../utils/logger');
const multer = require('multer');
const path = require('path');
const { uploadToGCS } = require('./upload.service');

// Keep in sync with the client (client/src/utils/uploadFile.js MAX_UPLOAD_BYTES).
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = '100 MB';

// Programs and installers are refused. The browser-sent MIME type is easy to change,
// so the extension is checked too. (Everything that is stored is served back either
// as a media type or as a forced download with nosniff, never rendered as a page.)
const BLOCKED_MIME_TYPES = new Set([
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-sh',
    'application/bat',
    'application/x-bat',
    'application/x-msi',
]);
const BLOCKED_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe', '.jse', '.wsf', '.cpl']);

/**
 * Browsers send the multipart filename as raw UTF-8 bytes, which busboy decodes as
 * latin1 ("Ã¼" for "ü"). Re-decode when the name round-trips as valid UTF-8.
 */
function fixFilenameEncoding(name) {
    if (typeof name !== 'string' || !name) return name;
    // eslint-disable-next-line no-control-regex
    if (!/[\u0080-ÿ]/.test(name) || /[^\u0000-ÿ]/.test(name)) return name;
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
}

function isBlockedFile(file) {
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    return BLOCKED_MIME_TYPES.has(mime) || BLOCKED_EXTENSIONS.has(ext);
}

const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
        file.originalname = fixFilenameEncoding(file.originalname);
        if (isBlockedFile(file)) {
            return cb(Object.assign(new Error('This file type is not allowed'), { code: 'FILE_TYPE_BLOCKED' }));
        }
        cb(null, true);
    },
});

/** multer errors become clear 4xx answers instead of the global 500 handler. */
function uploadErrorResponse(err) {
    const body = (error, extra) => ({ error, message: error, ...extra });
    if (err?.code === 'LIMIT_FILE_SIZE') return [413, body(`File too large (max ${MAX_FILE_SIZE_LABEL})`, { code: 'FILE_TOO_LARGE', maxBytes: MAX_FILE_SIZE })];
    if (err?.code === 'FILE_TYPE_BLOCKED') return [415, body('This file type is not allowed (programs and installers can’t be shared)', { code: 'FILE_TYPE_BLOCKED' })];
    if (err instanceof multer.MulterError) return [400, body(err.message || 'Invalid upload', { code: err.code })];
    return null;
}

const upload = {
    single(field) {
        const mw = multerUpload.single(field);
        return (req, res, next) => mw(req, res, (err) => {
            if (!err) return next();
            const mapped = uploadErrorResponse(err);
            if (mapped) return res.status(mapped[0]).json(mapped[1]);
            return next(err);
        });
    },
};

async function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { conversationType = 'channel' } = req.body;


        let folder;
        if (req.file.mimetype.startsWith('audio/')) {
            folder = 'voice';
        } else if (conversationType === 'dm') {
            folder = 'dms';
        } else {
            folder = 'channels';
        }

        // Record the uploader + company on the object so /uploads/file can authorize reads.
        const User = require('../../../models/User');
        const uploader = await User.findById(req.user.sub).select('companyId').lean();
        const attachment = await uploadToGCS(req.file, folder, {
            userId: req.user.sub,
            companyId: uploader?.companyId || undefined,
        });

        return res.status(200).json(attachment);
    } catch (err) {
        logger.error({ err }, '[UploadController] uploadFile error');
        const mapped = uploadErrorResponse(err);
        if (mapped) return res.status(mapped[0]).json(mapped[1]);
        return res.status(500).json({ error: 'Upload failed' });
    }
}

module.exports = {
    upload,
    uploadFile,
    fixFilenameEncoding,
    isBlockedFile,
    uploadErrorResponse,
    MAX_FILE_SIZE,
};
