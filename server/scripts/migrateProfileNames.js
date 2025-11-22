// server/scripts/migrateProfileNames.js
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI);

    const users = await User.find({});
    console.log(`Found ${users.length} users. Migrating...`);

    for (const u of users) {
      let changed = false;

      if (!u.profile) u.profile = {};

      if (!u.profile.name && u.username) {
        u.profile.name = u.username;
        changed = true;
      }

      // Move any old fields if they exist as root
      if (u.dob && !u.profile.dob) {
        u.profile.dob = u.dob;
        delete u.dob;
        changed = true;
      }

      if (u.about && !u.profile.about) {
        u.profile.about = u.about;
        delete u.about;
        changed = true;
      }

      if (u.company && !u.profile.company) {
        u.profile.company = u.company;
        delete u.company;
        changed = true;
      }

      if (changed) {
        await u.save();
        console.log(`Migrated: ${u.email}`);
      }
    }

    console.log("Migration completed.");
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
