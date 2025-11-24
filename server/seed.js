require("dotenv").config();
const mongoose = require("mongoose");
const Channel = require("./models/Channel");

const channels = [
    { name: "general", description: "General discussion for everyone", isPrivate: false },
    { name: "random", description: "Random chatter and fun", isPrivate: false },
    { name: "announcements", description: "Important updates", isPrivate: false },
    { name: "introductions", description: "Say hello to the team!", isPrivate: false }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        for (const ch of channels) {
            const exists = await Channel.findOne({ name: ch.name });
            if (!exists) {
                await Channel.create({
                    ...ch,
                    members: [], // Initially empty, users join manually
                    createdBy: new mongoose.Types.ObjectId("000000000000000000000000"), // System created
                    createdAt: new Date()
                });
                console.log(`Created channel: #${ch.name}`);
            } else {
                console.log(`Channel #${ch.name} already exists.`);
            }
        }

        console.log("Seeding complete!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
}

seed();
