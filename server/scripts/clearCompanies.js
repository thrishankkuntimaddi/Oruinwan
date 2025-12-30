// server/scripts/clearCompanies.js
// Clear all company-related data while preserving user accounts
// Run with: node scripts/clearCompanies.js

require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Invite = require('../models/Invite');
const Note = require('../models/Note');
const Task = require('../models/Task');
const Update = require('../models/Update');
const Message = require('../models/Message');
const DMSession = require('../models/DMSession');

const clearCompanies = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB Connected');

        console.log('\n🗑️  Starting company data cleanup...\n');

        // 1. Delete all Messages (channel and DM messages)
        const messagesDeleted = await Message.deleteMany({});
        console.log(`✅ Deleted ${messagesDeleted.deletedCount} messages`);

        // 2. Delete all DM Sessions
        const dmSessionsDeleted = await DMSession.deleteMany({});
        console.log(`✅ Deleted ${dmSessionsDeleted.deletedCount} DM sessions`);

        // 3. Delete all Updates
        const updatesDeleted = await Update.deleteMany({});
        console.log(`✅ Deleted ${updatesDeleted.deletedCount} updates`);

        // 4. Delete all Tasks
        const tasksDeleted = await Task.deleteMany({});
        console.log(`✅ Deleted ${tasksDeleted.deletedCount} tasks`);

        // 5. Delete all Notes
        const notesDeleted = await Note.deleteMany({});
        console.log(`✅ Deleted ${notesDeleted.deletedCount} notes`);

        // 6. Delete all Channels
        const channelsDeleted = await Channel.deleteMany({});
        console.log(`✅ Deleted ${channelsDeleted.deletedCount} channels`);

        // 7. Delete all Workspaces
        const workspacesDeleted = await Workspace.deleteMany({});
        console.log(`✅ Deleted ${workspacesDeleted.deletedCount} workspaces`);

        // 8. Delete all Invites
        const invitesDeleted = await Invite.deleteMany({});
        console.log(`✅ Deleted ${invitesDeleted.deletedCount} invites`);

        // 9. Delete all Companies
        const companiesDeleted = await Company.deleteMany({});
        console.log(`✅ Deleted ${companiesDeleted.deletedCount} companies`);

        // 10. Update Users - Remove company associations
        const usersUpdated = await User.updateMany(
            {},
            {
                $set: {
                    userType: 'personal',
                    companyId: null,
                    companyRole: 'member',
                    workspaces: [],
                    departments: [],
                    personalWorkspace: null
                }
            }
        );
        console.log(`✅ Updated ${usersUpdated.modifiedCount} users (removed company associations)`);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 CLEANUP COMPLETE!');
        console.log('='.repeat(60));
        console.log('\n📊 Summary:');
        console.log(`   • ${companiesDeleted.deletedCount} companies deleted`);
        console.log(`   • ${workspacesDeleted.deletedCount} workspaces deleted`);
        console.log(`   • ${channelsDeleted.deletedCount} channels deleted`);
        console.log(`   • ${messagesDeleted.deletedCount} messages deleted`);
        console.log(`   • ${dmSessionsDeleted.deletedCount} DM sessions deleted`);
        console.log(`   • ${tasksDeleted.deletedCount} tasks deleted`);
        console.log(`   • ${notesDeleted.deletedCount} notes deleted`);
        console.log(`   • ${updatesDeleted.deletedCount} updates deleted`);
        console.log(`   • ${invitesDeleted.deletedCount} invites deleted`);
        console.log(`   • ${usersUpdated.modifiedCount} users updated (company data removed)`);

        const remainingUsers = await User.countDocuments();
        console.log(`\n✅ ${remainingUsers} user accounts preserved (converted to personal accounts)`);

        console.log('\n💡 Next Steps:');
        console.log('   1. Users can now register new companies');
        console.log('   2. Or you can run: node seed.js to create test company');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup Error:', err);
        process.exit(1);
    }
};

clearCompanies();
