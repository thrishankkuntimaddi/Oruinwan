require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function verifyUser(email) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB\n');

    const user = await User.findOne({ email });

    if (!user) {
        console.log(`❌ User ${email} not found`);
        process.exit(1);
    }

    console.log(`Found user: ${user.username} (${user.email})`);
    console.log(`Current status: verified=${user.verified}`);

    user.verified = true;
    user.accountStatus = 'active';
    await user.save();

    console.log(`\n✅ User ${email} is now verified and active!`);
    process.exit(0);
}

const email = process.argv[2] || 'kuntimaddithrishank@gmail.com';
verifyUser(email).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
