require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');

const seedPendingCompany = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        // Create a pending company
        const company = await Company.create({
            name: "Test Corp",
            domain: "test.com",
            verificationStatus: "pending",
            documents: [{ name: "Business License", url: "https://example.com/license.pdf" }]
        });

        // Create an admin user for this company
        await User.create({
            name: "Test Admin",
            email: "admin@test.com",
            personalEmail: "admin@test.com",
            password: "password123", // Hash this ideally, but for test logic might be bypassed or plain if model handles it? 
            // Usually models pre-save hash. If not, it won't work for login, but we just need them for display in Admin Dashboard.
            companyId: company._id,
            companyRole: 'owner',
            roles: ['admin'],
            accountStatus: 'pending_verification'
        });

        console.log("✅ Seeded pending company 'Test Corp' with admin 'admin@test.com'");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
};

seedPendingCompany();
