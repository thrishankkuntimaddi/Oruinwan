const mongoose = require('mongoose');
const crypto = require('crypto');

const ComplianceLogSchema = new mongoose.Schema({
    
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

    
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorEmail: { type: String }, 
    actorRole: { type: String },  

    
    action: { type: String, required: true }, 
    category: {
        type: String,
        enum: ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'data-export', 'data-import'],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },

    
    resourceType: { type: String }, 
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    resourceName: { type: String }, 

    
    details: { type: mongoose.Schema.Types.Mixed },

    
    ipAddress: { type: String },
    userAgent: { type: String },

    
    
    hash: { type: String, required: true },

    
    createdAt: { type: Date, default: Date.now }

}, {
    timestamps: false, 
    versionKey: false  
});

ComplianceLogSchema.pre('save', function (next) {
    
    if (!this.isNew) {
        return next(new Error('ComplianceLog records are immutable and cannot be modified.'));
    }
    
    const ts = this.createdAt instanceof Date ? this.createdAt.getTime() : Date.now();
    const raw = `${this.companyId}|${this.actorId}|${this.action}|${String(this.resourceId || '')}|${ts}`;
    this.hash = crypto.createHash('sha256').update(raw).digest('hex');
    next();
});

ComplianceLogSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    next(new Error('ComplianceLog records cannot be updated via query middleware.'));
});

ComplianceLogSchema.index({ companyId: 1, createdAt: -1 });
ComplianceLogSchema.index({ actorId: 1, createdAt: -1 });
ComplianceLogSchema.index({ category: 1, severity: 1, createdAt: -1 });
ComplianceLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('ComplianceLog', ComplianceLogSchema);
