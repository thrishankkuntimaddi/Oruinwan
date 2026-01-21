/**
 * SupportTicket Model - Platform Support
 * 
 * PURPOSE:
 * - Platform support ticketing (company ↔ Chttrix platform admins)
 * - Technical support, billing, platform issues
 * - Cross-organization communication with platform team
 * 
 * SCOPE:
 * - Company admins/owners ↔ Chttrix platform administrators
 * - NOT for internal company tickets (use Ticket for that)
 * 
 * EXAMPLES:
 * - Billing inquiry to platform team
 * - Technical issue with Chttrix platform
 * - Feature request to Chttrix
 * - Account management questions
 * 
 * @see Ticket - For internal company ticketing
 */

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
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
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
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ priority: 1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
