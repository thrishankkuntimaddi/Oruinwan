const mongoose = require("mongoose");

/**
 * Platform Admin ↔ Company Admin Session
 * NOT workspace
 * NOT E2EE
 */
const PlatformSessionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
    },

    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: v => v.length === 2
    },

    lastMessageAt: {
      type: Date,
      default: Date.now
    },

    lastMessagePreview: {
      type: String,
      maxlength: 200
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

PlatformSessionSchema.index({ companyId: 1 });
PlatformSessionSchema.index({ participants: 1 });

module.exports = mongoose.model("PlatformSession", PlatformSessionSchema);
