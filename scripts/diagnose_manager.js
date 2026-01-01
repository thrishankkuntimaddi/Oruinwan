
const mongoose = require('mongoose');
const User = require('../server/models/User');
const Department = require('../server/models/Department');
const Workspace = require('../server/models/Workspace');
require('dotenv').config({ path: './server/.env' });

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const email = 'nani@theju.com';
        const user = await User.findOne({ email })
            .populate('managedDepartments')
            .populate('workspaces.workspace');

        if (!user) {
            console.log("User not found:", email);
            return;
        }

        console.log(`User: ${user.username} (${user._id})`);
        console.log("Managed Departments:", user.managedDepartments.length);

        for (const dept of user.managedDepartments) {
            console.log(`- Dept: ${dept.name} (${dept._id})`);
            console.log(`  Members Count: ${dept.members.length}`);
            console.log(`  Members IDs:`, dept.members);
        }

        console.log("Managed Workspaces:", user.workspaces.length);
        const ownedWorkspaces = user.workspaces.filter(w => w.role === 'owner' || w.role === 'admin');
        console.log("Owned/Admin Workspaces:", ownedWorkspaces.length);

        for (const w of ownedWorkspaces) {
            // workspace might be populated object or just id if structure varies
            const ws = w.workspace;
            if (ws) {
                console.log(`- Workspace: ${ws.name} (${ws._id})`);
                console.log(`  Members Count: ${ws.members.length}`);
            } else {
                console.log(`- Workspace ID: ${w.workspace} (Ref missing/null)`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

diagnose();
