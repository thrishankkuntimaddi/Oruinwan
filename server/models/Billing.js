const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true
    },
    plan: {
        type: String,
        enum: ['free', 'starter', 'professional', 'enterprise'], // Aligned with Company.js
        default: 'free'
    },
    amount: {
        type: Number,
        default: 0
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'annual'],
        default: 'monthly'
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'overdue', 'cancelled'],
        default: 'active'
    },
    lastPaymentDate: {
        type: Date
    },
    nextPaymentDate: {
        type: Date
    },
    paymentHistory: [{
        amount: Number,
        date: Date,
        status: {
            type: String,
            enum: ['success', 'failed', 'pending']
        },
        transactionId: String
    }]
}, {
    timestamps: true
});

// Index for queries
billingSchema.index({ status: 1 });

module.exports = mongoose.model('Billing', billingSchema);
