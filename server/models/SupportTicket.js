const mongoose = require("mongoose");

const TicketMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const SupportTicketSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  subject: { type: String, required: true },
  description: { type: String, required: true },
  
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

  // Platform Admin internal notes
  internalNotes: { type: String },
  
  resolvedAt: { type: Date },
  closedAt: { type: Date },

}, { timestamps: true });

SupportTicketSchema.index({ companyId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ priority: 1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
