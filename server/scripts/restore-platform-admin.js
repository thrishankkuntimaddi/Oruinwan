const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

const restorePlatformAdmin = async () => {
    console.log('\n🔍 Checking for platform admin...');

    // Check if platform admin exists
    let platformAdmin = await User.findOne({ email: 'chttrix-admin@chttrix.com' });

    if (platformAdmin) {
        console.log('✅ Platform admin exists:', platformAdmin.email);
        return;
    }

    console.log('⚠️  Platform admin not found. Creating...');

    // Create platform admin
    const passwordHash = await bcrypt.hash('Nani123@', 10);

    platformAdmin = await User.create({
        username: 'Chttrix Admin',
        email: 'chttrix-admin@chttrix.com',
        passwordHash,
        userType: 'personal',
        companyId: null,
        companyRole: 'member',
        roles: ['user', 'chttrix_admin'], // Using existing role pattern
        verified: true,
        accountStatus: 'active',
        profile: {
            name: 'Chttrix Admin',
            about: 'Platform Administrator'
        }
    });

    console.log('✅ Platform admin created:', platformAdmin.email);
    console.log('   Password: Nani123@');
};

const main = async () => {
    await connectDB();
    await restorePlatformAdmin();
    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
    process.exit(0);
};

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
