// Script to clear all billing dummy data
require('dotenv').config();
const mongoose = require('mongoose');
const Billing = require('../models/Billing');

const clearBillingData = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB Connected');

        // Get all billing records before deletion
        const billingRecords = await Billing.find();
        console.log(`\n📊 Found ${billingRecords.length} billing record(s)`);
        
        if (billingRecords.length > 0) {
            console.log('\n📋 Current billing records:');
            billingRecords.forEach((record, index) => {
                console.log(`   ${index + 1}. Company ID: ${record.companyId}, Plan: ${record.plan}, Amount: $${record.amount}, Status: ${record.status}`);
            });

            // Delete all billing records
            const result = await Billing.deleteMany({});
            console.log(`\n🗑️  Deleted ${result.deletedCount} billing record(s)`);
            console.log('✅ All billing data cleared successfully!');
        } else {
            console.log('ℹ️  No billing records found to delete');
        }

        // Verify deletion
        const remainingRecords = await Billing.countDocuments();
        console.log(`\n✓ Verification: ${remainingRecords} billing record(s) remaining`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

clearBillingData();
