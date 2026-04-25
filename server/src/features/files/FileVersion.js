const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', required: true, index: true },
    versionNumber: { type: Number, required: true },
    url: { type: String, required: true },
    gcsPath: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changeNote: { type: String, default: '' },
}, { timestamps: true });

fileVersionSchema.index({ fileId: 1, versionNumber: -1 });

module.exports = mongoose.model('FileVersion', fileVersionSchema);
