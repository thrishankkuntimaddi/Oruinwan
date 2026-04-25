const multer = require('multer');

const FILE_SIZE_LIMITS = {
    image: 5 * 1024 * 1024,      
    video: 50 * 1024 * 1024,     
    audio: 10 * 1024 * 1024,     
    document: 10 * 1024 * 1024   
};

const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
};

const getFileCategory = (mimetype) => {
    if (ALLOWED_TYPES.image.includes(mimetype)) return 'images';
    if (ALLOWED_TYPES.video.includes(mimetype)) return 'videos';
    if (ALLOWED_TYPES.audio.includes(mimetype)) return 'audio';
    if (ALLOWED_TYPES.document.includes(mimetype)) return 'documents';
    return null;
};

const fileFilter = (req, file, cb) => {
    const category = getFileCategory(file.mimetype);
    if (!category) {
        return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
    cb(null, true);
};

const uploadNoteAttachment = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 
    }
});

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
