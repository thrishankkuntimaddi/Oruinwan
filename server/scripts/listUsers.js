// Script to list all users in the database
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({}).select('username email authProvider linkedinId githubId verified accountStatus createdAt');

        console.log(`\n📊 Total users: ${users.length}\n`);

        if (users.length === 0) {
            console.log('No users found in database.');
        } else {
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Auth Provider: ${user.authProvider || 'local'}`);
                console.log(`   LinkedIn ID: ${user.linkedinId || 'N/A'}`);
                console.log(`   GitHub ID: ${user.githubId || 'N/A'}`);
                console.log(`   Verified: ${user.verified}`);
                console.log(`   Status: ${user.accountStatus}`);
                console.log(`   Created: ${user.createdAt}`);
                console.log('');
            });
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

listUsers();
