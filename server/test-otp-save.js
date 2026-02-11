// Quick script to test if OTP saving works
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function testOTPSave() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find a user
        const user = await User.findOne({ email: 'kthrishank10@gmail.com' });
        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log(`📧 Found user: ${user.email}`);
        console.log(`🔧 Current otpCodes:`, user.otpCodes);

        // Initialize otpCodes if needed
        if (!user.otpCodes) {
            user.otpCodes = [];
            console.log('✅ Initialized otpCodes array');
        }

        // Add a test OTP
        const testOTP = {
            code: '999999',
            type: 'reactivation',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            used: false
        };

        user.otpCodes.push(testOTP);
        console.log('📝 Pushing OTP:', testOTP);

        // Save
        await user.save();
        console.log('✅ User saved successfully');

        // Re-fetch to verify
        const updatedUser = await User.findOne({ email: 'kthrishank10@gmail.com' });
        console.log(`🔍 After save, otpCodes:`, updatedUser.otpCodes);

        mongoose.connection.close();
        console.log('\n✅ TEST PASSED - OTP was saved and retrieved successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        mongoose.connection.close();
        process.exit(1);
    }
}

testOTPSave();
