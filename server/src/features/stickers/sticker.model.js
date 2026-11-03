const mongoose = require('mongoose');

/**
 * One sticker in a person's own library. The file is a stored upload the owner can always
 * read (they uploaded it, or it was copied for them), so it can be sent to any conversation.
 * Packs are just names: stickers with the same `pack` show together.
 */
const StickerSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true }, // /api/v2/uploads/file?path=stickers/...
    name: { type: String, default: 'sticker' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    animated: { type: Boolean, default: false },
    pack: { type: String, default: 'My stickers', maxlength: 40 },
    // made: drawn from a photo · upload: a picture or GIF added as is · saved: from a message · giphy
    source: { type: String, enum: ['made', 'upload', 'saved', 'giphy'], default: 'upload' },
    // Where a saved or GIPHY sticker came from, so saving it twice doesn't add it twice.
    origin: { type: String, default: null },
}, { timestamps: true });

StickerSchema.index({ owner: 1, createdAt: -1 });
StickerSchema.index({ owner: 1, origin: 1 });

module.exports = mongoose.models.Sticker || mongoose.model('Sticker', StickerSchema);
