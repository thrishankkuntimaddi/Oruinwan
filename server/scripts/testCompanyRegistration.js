// server/scripts/testCompanyRegistration.js
// Test script for company registration endpoint

require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");

async function test() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");

        // Clean up test data if exists
        const testEmail = "testadmin@example.com";
        await User.deleteOne({ email: testEmail });
        await Company.deleteOne({ name: "Test Company" });
        console.log("🧹 Cleaned up old test data\n");

        // Test data
        const testData = {
            companyName: "Test Company",
            adminName: "Test Admin",
            adminEmail: testEmail,
            adminPassword: "TestPassword123!",
            domain: "example.com"
        };

        console.log("📝 Test Data:");
        console.log(JSON.stringify(testData, null, 2));
        console.log("\n");

        // Simulate the registration process
        console.log("🚀 Starting registration process...\n");

        // Step 1: Create Company
        const company = new Company({
            name: testData.companyName,
            domain: testData.domain ? testData.domain.toLowerCase() : null,
            domainVerified: false,
            billingEmail: testData.adminEmail
        });

        await company.save();
        console.log("✅ Step 1: Company created:", company._id);

        // Step 2: Create Admin User
        const bcrypt = require("bcryptjs");
        const passwordHash = await bcrypt.hash(testData.adminPassword, 12);

        const adminUser = new User({
            username: testData.adminName,
            email: testData.adminEmail,
            passwordHash,
            userType: "company",
            companyId: company._id,
            companyRole: "owner",
            verified: true
        });

        await adminUser.save();
        console.log("✅ Step 2: Admin user created:", adminUser._id);

        // Step 3: Add admin to company.admins
        company.admins.push({
            user: adminUser._id,
            role: "owner"
        });

        // Step 4: Create Default Workspace
        const defaultWorkspace = new Workspace({
            company: company._id,
            type: "company",
            name: `${testData.companyName} Workspace`,
            description: "Default company workspace",
            createdBy: adminUser._id,
            members: [{
                user: adminUser._id,
                role: "owner"
            }]
        });

        await defaultWorkspace.save();
        console.log("✅ Step 3: Default workspace created:", defaultWorkspace._id);

        // Update company with default workspace
        company.defaultWorkspace = defaultWorkspace._id;
        await company.save();

        // Update admin user's workspace memberships
        adminUser.workspaces.push({
            workspace: defaultWorkspace._id,
            role: "owner"
        });
        await adminUser.save();
        console.log("✅ Step 4: Company and admin updated with workspace");

        // Step 5: Create Default Channels
        const generalChannel = new Channel({
            workspace: defaultWorkspace._id,
            company: company._id,
            name: "general",
            description: "General discussion",
            isPrivate: false,
            isDefault: true,
            createdBy: adminUser._id,
            members: [{
                user: adminUser._id,
                joinedAt: new Date()
            }]
        });

        const announcementsChannel = new Channel({
            workspace: defaultWorkspace._id,
            company: company._id,
            name: "announcements",
            description: "Company announcements",
            isPrivate: false,
            isDefault: true,
            createdBy: adminUser._id,
            members: [{
                user: adminUser._id,
                joinedAt: new Date()
            }]
        });

        await generalChannel.save();
        await announcementsChannel.save();
        console.log("✅ Step 5: Default channels created (#general, #announcements)");

        // Update workspace with default channels
        defaultWorkspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
        await defaultWorkspace.save();
        console.log("✅ Step 6: Workspace updated with default channels");

        // Verify everything
        console.log("\n" + "=".repeat(80));
        console.log("✅ REGISTRATION TEST SUCCESSFUL!");
        console.log("=".repeat(80));
        console.log("Company ID:", company._id);
        console.log("Admin ID:", adminUser._id);
        console.log("Workspace ID:", defaultWorkspace._id);
        console.log("Channels:", generalChannel._id, announcementsChannel._id);
        console.log("=".repeat(80) + "\n");

        // Clean up
        await User.deleteOne({ _id: adminUser._id });
        await Channel.deleteMany({ workspace: defaultWorkspace._id });
        await Workspace.deleteOne({ _id: defaultWorkspace._id });
        await Company.deleteOne({ _id: company._id });
        console.log("🧹 Test data cleaned up");

    } catch (err) {
        console.error("\n❌ TEST FAILED:");
        console.error(err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("\n✅ Disconnected from MongoDB");
        process.exit(0);
    }
}

test();
