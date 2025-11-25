require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const count = await User.countDocuments();
        console.log(`\nTotal users in database: ${count}`);

        const users = await User.find().select("username email").lean();
        console.log("\nUsers:");
        users.forEach(u => {
            console.log(`  - ${u.username} (${u.email})`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkUsers();
