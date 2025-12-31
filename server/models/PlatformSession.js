const mongoose = require("mongoose");

/**
 * PlatformSession Model
 * 
 * Separate from DMSession to keep Platform Admin communication 
 * distinct from workspace communication.
 * 
 * Context: communication between Platform Super Admin and Company Owners/Admins
 */
const PlatformSessionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    // Participants: Usually [PlatformAdminUser, CompanyAdminUser]
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],

    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

PlatformSessionSchema.index({ companyId: 1 });
PlatformSessionSchema.index({ participants: 1 });

module.exports = mongoose.model("PlatformSession", PlatformSessionSchema);
