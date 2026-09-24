const logger = require('../../../utils/logger');
const multer = require('multer');
const { uploadToGCS } = require('./upload.service');

const MAX_FILE_SIZE = 100 * 1024 * 1024; 

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        
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
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large (max 100 MB)' });
        }
        return res.status(500).json({ error: 'Upload failed' });
    }
}

module.exports = {
    upload,       
    uploadFile,   
};
