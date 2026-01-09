const mongoose = require('mongoose');

/**
 * Invoice Model
 * Stores invoice and payment records for companies
 */
const InvoiceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },

    // Invoice details
    invoiceNumber: {
        type: String,
        required: true
    },

    // Amount and plan
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },

    // Plan details at time of invoice
    planType: {
        type: String,
        enum: ['free', 'starter', 'professional', 'enterprise'],
        required: true
    },
    planName: {
        type: String, // Display name like "Pro", "Enterprise"
        required: true
    },

    // Billing period
    billingPeriod: {
        start: Date,
        end: Date
    },

    // Seat information
    seatsIncluded: {
        type: Number,
        default: 0
    },
    seatsUsed: {
        type: Number,
        default: 0
    },

    // Payment status
    status: {
        type: String,
        enum: ['paid', 'pending', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },

    // Payment dates
    issueDate: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true
    },
    paidDate: {
        type: Date,
        default: null
    },

    // Payment method
    paymentMethod: {
        type: {
            type: String, // 'card', 'bank_transfer', 'paypal'
            default: 'card'
        },
        last4: String, // Last 4 digits of card
        brand: String, // 'visa', 'mastercard', etc.
    },

    // Transaction reference
    transactionId: {
        type: String,
        default: null
    },

    // Line items
    lineItems: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number
    }],

    // Totals
    subtotal: Number,
    tax: {
        rate: Number,
        amount: Number
    },
    discount: {
        code: String,
        amount: Number
    },
    total: {
        type: Number,
        required: true
    },

    // PDF and download
    pdfUrl: String,
    downloadLink: String,

    // Notes
    notes: String,

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes
InvoiceSchema.index({ companyId: 1, createdAt: -1 });
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ dueDate: 1 });

// Generate invoice number
InvoiceSchema.pre('save', async function (next) {
    if (!this.invoiceNumber) {
        const count = await mongoose.model('Invoice').countDocuments();
        this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
