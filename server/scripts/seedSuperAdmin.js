
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('📦 MongoDB Connected');

        const email = 'chttrix@ch.com';
        const password = 'Nani123@';
        const username = 'Chttrix Manager';

        // Check if exists
        let admin = await User.findOne({ email });
        if (admin) {
            console.log('⚠️ Super Admin already exists');
        } else {
            const passwordHash = await bcrypt.hash(password, 12);
            admin = new User({
                username,
                email,
                passwordHash,
                userType: 'company', // Special type or normal? using 'company' generically or needs 'super_admin'
                // Let's use specific roles for identifying super admin
                roles: ['user', 'chttrix_admin'],
                verified: true,
                accountStatus: 'active',
                // It doesn't need to belong to a specific company in the schema, or we create a "Chttrix" company.
                // For simplicity, null companyId but 'chttrix_admin' role grants global access.
                companyId: null
            });
            await admin.save();
            console.log('✅ Super Admin Created: chttrix@ch.com');
        }

        process.exit();
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

seedSuperAdmin();
