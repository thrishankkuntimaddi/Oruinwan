const mongoose = require('mongoose');

const ScimTokenSchema = new mongoose.Schema({
    
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },

    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    
    
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    
    label: {
        type: String,
        default: 'SCIM Token',
    },

    
    provider: {
        type: String,
        enum: ['workday', 'bamboohr', 'rippling', 'generic', null],
        default: 'generic',
    },

    
    isActive: { type: Boolean, default: true, index: true },

    
    expiresAt: { type: Date, default: null },

    
    lastUsedAt: { type: Date, default: null },

}, {
    timestamps: true,
    collection: 'scim_tokens',
});

ScimTokenSchema.index({ tokenHash: 1, isActive: 1 });

module.exports = mongoose.model('ScimToken', ScimTokenSchema);
