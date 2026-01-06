const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const run = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chttrix');

        const email = 'nani@theju.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found!');
            process.exit(1);
        }

        user.verified = true;
        user.accountStatus = 'active'; // Ensure active

        // Also ensure they have at least one verified email in the array if used
        if (user.emails && user.emails.length > 0) {
            user.emails[0].verified = true;
        }

        await user.save();
        console.log(`✅ User ${email} has been manually VERIFIED.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
