const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    targetType: {
        type: String,
        enum: ['all', 'active', 'pending', 'specific'],
        required: true
    },
    targetCompanies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    }],
    recipientCount: {
        type: Number,
        default: 0
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    scheduledAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['sent', 'scheduled', 'failed'],
        default: 'sent'
    }
}, {
    timestamps: true
});

// Index for queries
broadcastSchema.index({ sentAt: -1 });
broadcastSchema.index({ sentBy: 1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
