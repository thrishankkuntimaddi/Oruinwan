// server/models/Company.js
const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, unique: true, sparse: true }, // optional
  domainVerified: { type: Boolean, default: false },
  domainVerificationToken: { type: String, default: null }, // store short token (not secret)
  domainVerificationExpires: { type: Date, default: null },
  allowedEmails: [{ type: String }], // optional list of pre-approved emails
  invitePolicy: {
    requireInvite: { type: Boolean, default: false },
    allowExternalInvite: { type: Boolean, default: false }
  },
  plan: { type: String, default: "free" },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model("Company", CompanySchema);
