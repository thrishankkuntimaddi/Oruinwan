// server/config/multer.config.js
const multer = require('multer');
const path = require('path');
const mime = require('mime-types');

// Define file size limits by category (in bytes)
const FILE_SIZE_LIMITS = {
    image: 5 * 1024 * 1024,      // 5MB
    video: 50 * 1024 * 1024,     // 50MB
    audio: 10 * 1024 * 1024,     // 10MB
    document: 10 * 1024 * 1024   // 10MB
};

// Allowed MIME types by category
const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
};

// Determine file category from MIME type
const getFileCategory = (mimetype) => {
    if (ALLOWED_TYPES.image.includes(mimetype)) return 'images';
    if (ALLOWED_TYPES.video.includes(mimetype)) return 'videos';
    if (ALLOWED_TYPES.audio.includes(mimetype)) return 'audio';
    if (ALLOWED_TYPES.document.includes(mimetype)) return 'documents';
    return null;
};

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = getFileCategory(file.mimetype);

        if (!category) {
            return cb(new Error('Invalid file type'), null);
        }

        const uploadPath = path.join(__dirname, '../uploads/notes', category);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp_randomstring.ext
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const extension = mime.extension(file.mimetype);
        cb(null, `${uniqueSuffix}.${extension}`);
    }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
    const category = getFileCategory(file.mimetype);

    if (!category) {
        return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }

    cb(null, true);
};

// Create multer instance for note attachments
const uploadNoteAttachment = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // Max 50MB (will be further validated per category)
    }
});

// Validate file size based on category
const validateFileSize = (file) => {
    const category = getFileCategory(file.mimetype);
    if (!category) return false;

    const categoryKey = category === 'images' ? 'image' :
        category === 'videos' ? 'video' :
            category === 'audio' ? 'audio' : 'document';

    const limit = FILE_SIZE_LIMITS[categoryKey];
    return file.size <= limit;
};

module.exports = {
    uploadNoteAttachment,
    getFileCategory,
    validateFileSize,
    FILE_SIZE_LIMITS,
    ALLOWED_TYPES
};
