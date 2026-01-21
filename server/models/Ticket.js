/**
 * Ticket Model - Internal Company Ticketing
 * 
 * PURPOSE:
 * - Internal ticketing system WITHIN a company
 * - Employee-to-employee support requests
 * - Internal IT, facilities, HR tickets
 * 
 * SCOPE:
 * - Company employees ↔ Company employees
 * - NOT for platform support (use SupportTicket for that)
 * 
 * EXAMPLES:
 * - Employee requests new equipment
 * - Facilities maintenance request
 * - Internal IT support ticket
 * - Department collaboration requests
 * 
 * @see SupportTicket - For platform support (company ↔ Chttrix admins)
 */

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        message: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: Date
    }]
}, {
    timestamps: true
});

// Index for faster queries
ticketSchema.index({ companyId: 1, status: 1 });
ticketSchema.index({ creatorId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
