// server/scripts/nukeDbPreserveAdmin.js
// Clear entire database EXCEPT the Chttrix platform admin account
// Use with caution - this deletes all company data, users, workspaces, messages, etc.

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");

// Import all models
const User = require("../models/User");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const DMSession = require("../models/DMSession");
const Task = require("../models/Task");
const TaskActivity = require("../models/TaskActivity");
const Note = require("../models/Note");
const Invite = require("../models/Invite");
const AuditLog = require("../models/AuditLog");
const Ticket = require("../models/Ticket");
const Broadcast = require("../models/Broadcast");
const ConversationKey = require("../models/ConversationKey");

const CHTTRIX_ADMIN_EMAIL = process.env.CHTTRIX_ADMIN_EMAIL || "chttrix-admin@chttrix.com";

async function nukeDbPreserveAdmin() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // Find the platform admin to preserve
        const adminUser = await User.findOne({ email: CHTTRIX_ADMIN_EMAIL });

        if (!adminUser) {
            console.warn("⚠️  Warning: Chttrix admin not found! Database will be completely cleared.");
            console.log("   Run createChttrixAdmin.js after this script to recreate the admin.");
        }

        console.log("\n" + "=".repeat(70));
        console.log("⚠️  WARNING: DATABASE NUKE IN PROGRESS");
        console.log("=".repeat(70));
        console.log("This will DELETE ALL DATA except:");
        console.log(`  - Platform Admin: ${CHTTRIX_ADMIN_EMAIL}`);
        console.log("=".repeat(70));

        // Wait 3 seconds for user to cancel if needed
        console.log("\n⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n");
        await new Promise(resolve => setTimeout(resolve, 3000));

        const adminId = adminUser ? adminUser._id : null;

        // Delete all data except admin user
        console.log("\n🗑️  Deleting collections...\n");

        // Delete all users except admin
        if (adminId) {
            const deletedUsers = await User.deleteMany({ _id: { $ne: adminId } });
            console.log(`✅ Users: Deleted ${deletedUsers.deletedCount}, Preserved: 1 (admin)`);
        } else {
            const deletedUsers = await User.deleteMany({});
            console.log(`✅ Users: Deleted ${deletedUsers.deletedCount}`);
        }

        const { UserWorkspaceKey, WorkspaceKey } = require("../models/encryption");

        // Delete all other collections (no preservation needed)
        const results = await Promise.all([
            Company.deleteMany({}),
            Department.deleteMany({}),
            Workspace.deleteMany({}),
            Channel.deleteMany({}),
            Message.deleteMany({}),
            DMSession.deleteMany({}),
            Task.deleteMany({}),
            TaskActivity.deleteMany({}),
            Note.deleteMany({}),
            Invite.deleteMany({}),
            AuditLog.deleteMany({}),
            Ticket.deleteMany({}),
            Broadcast.deleteMany({}),
            UserWorkspaceKey.deleteMany({}),
            WorkspaceKey.deleteMany({}),
            ConversationKey.deleteMany({})
        ]);

        console.log(`✅ Companies: Deleted ${results[0].deletedCount}`);
        console.log(`✅ Departments: Deleted ${results[1].deletedCount}`);
        console.log(`✅ Workspaces: Deleted ${results[2].deletedCount}`);
        console.log(`✅ Channels: Deleted ${results[3].deletedCount}`);
        console.log(`✅ Messages: Deleted ${results[4].deletedCount}`);
        console.log(`✅ DM Sessions: Deleted ${results[5].deletedCount}`);
        console.log(`✅ Tasks: Deleted ${results[6].deletedCount}`);
        console.log(`✅ Task Activities: Deleted ${results[7].deletedCount}`);
        console.log(`✅ Notes: Deleted ${results[8].deletedCount}`);
        console.log(`✅ Invites: Deleted ${results[9].deletedCount}`);
        console.log(`✅ Audit Logs: Deleted ${results[10].deletedCount}`);
        console.log(`✅ Tickets: Deleted ${results[11].deletedCount}`);
        console.log(`✅ Broadcasts: Deleted ${results[12].deletedCount}`);
        console.log(`✅ User Workspace Keys: Deleted ${results[13].deletedCount}`);
        console.log(`✅ Workspace Master Keys: Deleted ${results[14].deletedCount}`);
        console.log(`✅ Conversation Keys: Deleted ${results[15].deletedCount}`);

        console.log("\n" + "=".repeat(70));
        console.log("✅ DATABASE NUKE COMPLETE");
        console.log("=".repeat(70));

        if (adminUser) {
            console.log(`\n✅ Preserved Platform Admin:`);
            console.log(`   Email: ${adminUser.email}`);
            console.log(`   Username: ${adminUser.username}`);
        } else {
            console.log(`\n⚠️  No admin preserved. Run createChttrixAdmin.js to create one.`);
        }

        console.log("\n");

        await mongoose.connection.close();
        console.log("🔌 Database connection closed");

    } catch (err) {
        console.error("❌ Error nuking database:", err);
        process.exit(1);
    }
}

// Run the script
nukeDbPreserveAdmin();
