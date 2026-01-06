const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Company = require("../models/Company");
const Workspace = require("../models/Workspace");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const Note = require("../models/Note");
const Task = require("../models/Task");
const Update = require("../models/Update");
const Department = require("../models/Department");
const DMSession = require("../models/DMSession");

const Favorite = require("../models/Favorite");
const Invite = require("../models/Invite");

const nukeDatabase = async () => {
    try {
        console.log("Connecting to Database...");
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`Connected to MongoDB: ${conn.connection.host}`);

        const adminEmail = "thrishank@ch.com";
        const adminUser = await User.findOne({ email: adminEmail });

        if (!adminUser) {
            console.warn(`Admin user ${adminEmail} not found. Proceeding to nuke ALL data.`);
        } else {
            console.log(`Preserving Admin User: ${adminUser.email} (${adminUser._id})`);
        }

        // Delete all collections except preserved admin
        // Users
        const deleteUsersResult = await User.deleteMany({ email: { $ne: adminEmail } });
        console.log(`Deleted ${deleteUsersResult.deletedCount} Users.`);

        // Companies
        const deleteCompaniesResult = await Company.deleteMany({});
        console.log(`Deleted ${deleteCompaniesResult.deletedCount} Companies.`);

        // Workspaces
        const deleteWorkspacesResult = await Workspace.deleteMany({});
        console.log(`Deleted ${deleteWorkspacesResult.deletedCount} Workspaces.`);

        // Departments
        const deleteDepartmentsResult = await Department.deleteMany({});
        console.log(`Deleted ${deleteDepartmentsResult.deletedCount} Departments.`);

        // Channels
        const deleteChannelsResult = await Channel.deleteMany({});
        console.log(`Deleted ${deleteChannelsResult.deletedCount} Channels.`);

        // Messages
        const deleteMessagesResult = await Message.deleteMany({});
        console.log(`Deleted ${deleteMessagesResult.deletedCount} Messages.`);

        // Notes
        const deleteNotesResult = await Note.deleteMany({});
        console.log(`Deleted ${deleteNotesResult.deletedCount} Notes.`);

        // Tasks
        const deleteTasksResult = await Task.deleteMany({});
        console.log(`Deleted ${deleteTasksResult.deletedCount} Tasks.`);

        // Updates
        const deleteUpdatesResult = await Update.deleteMany({});
        console.log(`Deleted ${deleteUpdatesResult.deletedCount} Updates.`);

        // DM Sessions
        const deleteDMSessionsResult = await DMSession.deleteMany({});
        console.log(`Deleted ${deleteDMSessionsResult.deletedCount} DM Sessions.`);

        // Invites
        const deleteInvitesResult = await Invite.deleteMany({});
        console.log(`Deleted ${deleteInvitesResult.deletedCount} Invites.`);

        // Favorites
        const deleteFavoritesResult = await Favorite.deleteMany({});
        console.log(`Deleted ${deleteFavoritesResult.deletedCount} Favorites.`);

        console.log("Database Nuked Successfully! ☢️");
        process.exit(0);

    } catch (error) {
        console.error("Error nuking database:", error);
        process.exit(1);
    }
};

nukeDatabase();
