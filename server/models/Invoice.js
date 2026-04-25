const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },

    
    invoiceNumber: {
        type: String,
        required: true
    },

    
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },

    
    planType: {
        type: String,
        enum: ['free', 'starter', 'professional', 'enterprise'],
        required: true
    },
    planName: {
        type: String, 
        required: true
    },

    
    billingPeriod: {
        start: Date,
        end: Date
    },

    
    seatsIncluded: {
        type: Number,
        default: 0
    },
    seatsUsed: {
        type: Number,
        default: 0
    },

    
    status: {
        type: String,
        enum: ['paid', 'pending', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },

    
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

    
    paymentMethod: {
        type: {
            type: String, 
            default: 'card'
        },
        last4: String, 
        brand: String, 
    },

    
    transactionId: {
        type: String,
        default: null
    },

    
    lineItems: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number
    }],

    
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

    
    pdfUrl: String,
    downloadLink: String,

    
    notes: String,

    
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

InvoiceSchema.index({ companyId: 1, createdAt: -1 });
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ dueDate: 1 });

InvoiceSchema.pre('save', async function (next) {
    if (!this.invoiceNumber) {
        const count = await mongoose.model('Invoice').countDocuments();
        this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
