const mongoose = require("mongoose");

const TicketMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      required: true
    },

    isFromAdmin: {
      type: Boolean,
      default: false
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const SupportTicketSchema = new mongoose.Schema(
  {
    // Null for personal accounts: tickets from users outside a company.
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null
    },

    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    subject: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    category: {
      type: String,
      enum: ["question", "problem", "feedback", "billing"],
      default: "question"
    },

    // Where the request came from (page path, app version, browser). Never message contents.
    context: {
      path: { type: String, maxlength: 300 },
      appVersion: { type: String, maxlength: 60 },
      userAgent: { type: String, maxlength: 400 }
    },

    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open"
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    messages: [TicketMessageSchema],

    internalNotes: {
      type: String,
      default: ""
    },

    resolvedAt: Date,
    closedAt: Date
  },
  { timestamps: true }
);

SupportTicketSchema.index({ companyId: 1, createdAt: -1 });
SupportTicketSchema.index({ creatorId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ priority: 1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
