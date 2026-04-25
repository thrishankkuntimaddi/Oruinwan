const mongoose = require("mongoose");
const crypto = require("crypto");

const AuditLogSchema = new mongoose.Schema({
    
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    
    action: { type: String, required: true }, 
    resource: { type: String }, 
    resourceId: { type: mongoose.Schema.Types.ObjectId },

    
    details: { type: mongoose.Schema.Types.Mixed },
    description: { type: String },

    
    ipAddress: { type: String },
    userAgent: { type: String },
    endpoint: { type: String },
    method: { type: String },

    
    status: { type: String, enum: ["success", "failure", "pending"], default: "success" },
    errorMessage: { type: String },

    
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },
    category: {
        type: String,
        enum: ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'messaging', 'system'],
        default: 'system'
    },

    
    
    immutableHash: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
}, { timestamps: false }); 

AuditLogSchema.pre('save', function (next) {
    if (!this.immutableHash) {
        const payload = `${this.userId}|${this.action}|${String(this.resourceId || '')}|${this.createdAt.getTime()}`;
        this.immutableHash = crypto.createHash('sha256').update(payload).digest('hex');
    }
    next();
});

AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ severity: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
