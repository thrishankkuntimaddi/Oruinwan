// server/scripts/check-db.js
// Script to check database contents and verify if it's clean

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

// Import all models
const User = require("../models/User");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const Task = require("../models/Task");
const Note = require("../models/Note");

async function checkDatabase() {
    try {
        console.log("\n🔍 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB\n");

        console.log("📊 Database Contents Summary:");
        console.log("=".repeat(50));

        // Check each collection
        const collections = [
            { name: "Users", model: User },
            { name: "Companies", model: Company },
            { name: "Departments", model: Department },
            { name: "Workspaces", model: Workspace },
            { name: "Channels", model: Channel },
            { name: "Messages", model: Message },
            { name: "Tasks", model: Task },
            { name: "Notes", model: Note },
        ];

        let totalDocuments = 0;
        const details = [];

        for (const collection of collections) {
            const count = await collection.model.countDocuments();
            totalDocuments += count;

            const status = count === 0 ? "✅ CLEAN" : "⚠️  HAS DATA";
            console.log(`${status} | ${collection.name}: ${count} documents`);

            if (count > 0) {
                details.push({ collection: collection.name, count, model: collection.model });
            }
        }

        console.log("=".repeat(50));
        console.log(`\nTotal Documents: ${totalDocuments}\n`);

        if (totalDocuments === 0) {
            console.log("🎉 DATABASE IS COMPLETELY CLEAN! 🎉\n");
        } else {
            console.log("⚠️  DATABASE CONTAINS DATA\n");
            console.log("📋 Detailed Breakdown:");
            console.log("-".repeat(50));

            for (const detail of details) {
                console.log(`\n${detail.collection}:`);
                const docs = await detail.model.find().limit(5).lean();
                docs.forEach((doc, idx) => {
                    console.log(`  ${idx + 1}. ${doc.name || doc.email || doc.title || doc._id}`);
                });
                if (detail.count > 5) {
                    console.log(`  ... and ${detail.count - 5} more`);
                }
            }
        }

        await mongoose.connection.close();
        console.log("\n✅ Database connection closed\n");
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

checkDatabase();
