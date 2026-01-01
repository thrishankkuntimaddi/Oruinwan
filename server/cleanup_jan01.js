const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const Workspace = require('./models/Workspace');
require('dotenv').config({ path: './.env' });

async function deleteUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'lilly@kt.com';
        console.log(`🔍 Finding user: ${email}...`);

        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User not found.');
        } else {
            console.log(`✅ Found user: ${user.username} (ID: ${user._id})`);

            // 1. Remove from all Departments
            const deptUpdate = await Department.updateMany(
                { members: user._id },
                { $pull: { members: user._id } }
            );
            console.log(`   - Removed from ${deptUpdate.modifiedCount} departments.`);

            // 2. Remove from all Workspaces
            const wsUpdate = await Workspace.updateMany(
                { "members.user": user._id },
                { $pull: { members: { user: user._id } } }
            );
            console.log(`   - Removed from ${wsUpdate.modifiedCount} workspaces.`);

            // 3. Delete the User
            await User.deleteOne({ _id: user._id });
            console.log(`🗑️  User ${email} deleted successfully.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected');
    }
}

deleteUser();
