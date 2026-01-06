require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkAdmins() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB\n');

    const admins = await User.find({ roles: 'chttrix_admin' })
        .select('username email roles accountStatus createdAt');

    console.log(`Found ${admins.length} Chttrix Admin(s):\n`);
    admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.username}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Status: ${admin.accountStatus}`);
        console.log(`   Created: ${admin.createdAt}`);
        console.log('');
    });

    process.exit(0);
}

checkAdmins().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
