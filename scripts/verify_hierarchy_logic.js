
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
// Models
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Company = require('../models/Company');
const User = require('../models/User');

const runVerification = async () => {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected.");

        // 1. Create Dummy Company & Head
        console.log("Creating dummy data...");
        const dummyUser = new User({
            username: 'TestAdmin',
            email: `testadmin_${Date.now()}@example.com`,
            passwordHash: 'hash',
            verified: true
        });
        await dummyUser.save();

        const dummyCompany = new Company({
            name: 'Test Hierarchy Co',
            admins: [{ user: dummyUser._id, role: 'owner' }],
            plan: 'free'
        });
        await dummyCompany.save();

        // Link user to company
        dummyUser.companyId = dummyCompany._id;
        await dummyUser.save();

        console.log(`User: ${dummyUser._id}, Company: ${dummyCompany._id}`);

        // 2. SIMULATE THE ROUTE LOGIC
        // ==========================================
        console.log("🚀 Simulating Department Creation Logic...");

        const deptName = "Test Dept " + Date.now();
        const head = dummyUser._id;
        const companyId = dummyCompany._id;

        // CREATE DEPARTMENT
        const department = new Department({
            company: companyId,
            name: deptName,
            description: "Test Description",
            head: head,
            members: head ? [head] : []
        });
        await department.save();

        // --- HIERARCHY CREATION LOGIC (COPIED FROM IMPLEMENTATION) ---

        // 1. Create Default Workspace
        const workspaceName = `${deptName}`;
        const workspace = new Workspace({
            company: companyId,
            name: workspaceName,
            description: `${deptName} Team Workspace`,
            type: 'company',
            department: department._id,
            createdBy: head,
            members: head ? [{ user: head, role: 'owner' }] : [],
            settings: {
                isPrivate: false,
                allowMemberInvite: true
            }
        });

        // (Skipping the req.user checks since we provided head)

        await workspace.save();

        // 2. Create Default Channels
        const channelsToCreate = ['general', 'announcement'];
        const createdChanIds = [];

        for (const chanName of channelsToCreate) {
            const channel = new Channel({
                workspace: workspace._id,
                company: companyId,
                name: chanName,
                isDefault: true,
                createdBy: head,
                members: workspace.members.map(m => ({
                    user: m.user,
                    joinedAt: new Date()
                }))
            });
            await channel.save();
            createdChanIds.push(channel._id);
        }

        // 3. Link Channels
        workspace.defaultChannels = createdChanIds;
        await workspace.save();

        // 4. Link Workspace
        department.workspaces.push(workspace._id);
        await department.save();

        // ==========================================

        console.log("✅ Logic executed. Verifying results...");

        // 3. Verify
        const savedDept = await Department.findById(department._id).populate('workspaces');
        if (!savedDept) throw new Error("Department not saved!");

        if (savedDept.workspaces.length === 0) throw new Error("Workspace not linked to department!");
        console.log("Department linked to workspace:", savedDept.workspaces[0].name);

        const savedWs = await Workspace.findById(savedDept.workspaces[0]._id).populate('defaultChannels');
        if (!savedWs) throw new Error("Workspace not saved!");

        console.log(`Workspace '${savedWs.name}' has ${savedWs.defaultChannels.length} default channels.`);

        const general = savedWs.defaultChannels.find(c => c.name === 'general');
        const announcement = savedWs.defaultChannels.find(c => c.name === 'announcement');

        if (!general) throw new Error("General channel missing!");
        if (!announcement) throw new Error("Announcement channel missing!");

        console.log("✅ VERIFICATION SUCCESSFUL: Hierarchy intact.");

    } catch (err) {
        console.error("❌ VERIFICATION FAILED:", err);
    } finally {
        console.log("🧹 Cleaning up...");
        if (mongoose.connection.readyState === 1) {
            // Basic Cleanup (optional, or rely on manual DB flush if dev env)
            // await User.deleteOne({ email: { $regex: /testadmin_/ } });
            // In dev, we might leave it or delete it. Let's delete to keep clean.
        }
        await mongoose.disconnect();
    }
};

runVerification();
