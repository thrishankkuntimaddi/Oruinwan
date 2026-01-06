
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('📦 MongoDB Connected');

        // Default Chttrix Super Admin Credentials
        const email = 'chttrix-admin@chttrix.com';
        const password = 'xm4kcjwf89';
        const username = 'Chttrix Admin';

        // Check if exists
        let admin = await User.findOne({ email });
        if (admin) {
            console.log('⚠️  Chttrix Super Admin already exists');
            console.log(`   Email: ${email}`);
        } else {
            const passwordHash = await bcrypt.hash(password, 12);
            admin = new User({
                username,
                email,
                passwordHash,
                userType: 'personal', // Not tied to any company
                roles: ['user', 'chttrix_admin'], // Special super admin role
                verified: true,
                accountStatus: 'active',
                companyId: null // Global admin, not tied to any company
            });
            await admin.save();
            console.log('✅ Chttrix Super Admin Created!');
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
        }

        process.exit();
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

seedSuperAdmin();
