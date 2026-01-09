// Quick script to check owner user in database
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function checkOwner() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all owners
        const owners = await User.find({ companyRole: 'owner' }).select('email username companyRole companyId');

        console.log('\n=== OWNERS IN DATABASE ===');
        console.log(`Found ${owners.length} owner(s):\n`);

        owners.forEach((owner, index) => {
            console.log(`Owner #${index + 1}:`);
            console.log(`  Email: ${owner.email}`);
            console.log(`  Username: ${owner.username}`);
            console.log(`  Role: ${owner.companyRole}`);
            console.log(`  Company ID: ${owner.companyId}`);
            console.log('');
        });

        if (owners.length === 0) {
            console.log('⚠️  NO OWNERS FOUND! You need to seed an owner user.');
            console.log('   Check seed-dashboard-test.js or create an owner manually.');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkOwner();
