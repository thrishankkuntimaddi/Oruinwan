// server/models/SupportMessage.js
const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    isFromPlatformAdmin: {
        type: Boolean,
        default: false
    },
    read: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        url: String,
        size: Number
    }]
}, {
    timestamps: true
});

// Index for faster queries
supportMessageSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
