// server/scripts/createChttrixAdmin.js
// One-time script to create the default Chttrix super admin user

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const CHTTRIX_ADMIN_EMAIL = "thrishank@ch.com";
const CHTTRIX_ADMIN_PASSWORD = "Nani123@";
const CHTTRIX_ADMIN_USERNAME = "Chttrix Admin";

async function createChttrixAdmin() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: CHTTRIX_ADMIN_EMAIL });

        if (existingAdmin) {
            console.log("⚠️  Chttrix admin user already exists!");
            console.log("📧 Email:", existingAdmin.email);
            console.log("👤 Username:", existingAdmin.username);
            console.log("🔑 Roles:", existingAdmin.roles);

            // Update roles if needed
            if (!existingAdmin.roles.includes("chttrix_admin")) {
                existingAdmin.roles.push("chttrix_admin");
                await existingAdmin.save();
                console.log("✅ Added 'chttrix_admin' role to existing user");
            }

            await mongoose.connection.close();
            return;
        }

        // Hash password
        console.log("🔐 Hashing password...");
        const passwordHash = await bcrypt.hash(CHTTRIX_ADMIN_PASSWORD, 12);

        // Create admin user
        console.log("👤 Creating Chttrix admin user...");
        const adminUser = new User({
            username: CHTTRIX_ADMIN_USERNAME,
            email: CHTTRIX_ADMIN_EMAIL,
            passwordHash: passwordHash,
            userType: "personal", // Not tied to any company
            verified: true, // Skip email verification
            roles: ["user", "chttrix_admin"], // Super admin role
            accountStatus: "active",
            profile: {
                name: CHTTRIX_ADMIN_USERNAME,
                about: "Chttrix Platform Administrator"
            }
        });

        await adminUser.save();

        console.log("\n" + "=".repeat(60));
        console.log("✅ Chttrix Admin User Created Successfully!");
        console.log("=".repeat(60));
        console.log("📧 Email:", CHTTRIX_ADMIN_EMAIL);
        console.log("🔑 Password:", CHTTRIX_ADMIN_PASSWORD);
        console.log("👤 Username:", CHTTRIX_ADMIN_USERNAME);
        console.log("🛡️  Roles:", adminUser.roles);
        console.log("=".repeat(60));
        console.log("\n⚠️  IMPORTANT: Change the default password after first login!");
        console.log("🔗 Login URL: http://localhost:3000/login\n");

        await mongoose.connection.close();
        console.log("🔌 Database connection closed");

    } catch (err) {
        console.error("❌ Error creating Chttrix admin:", err);
        process.exit(1);
    }
}

// Run the script
createChttrixAdmin();
