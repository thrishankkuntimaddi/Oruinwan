const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Company = require("../models/Company");
const Workspace = require("../models/Workspace");
const Department = require("../models/Department");
const Channel = require("../models/Channel");

// Data Configuration
const companyData = {
    name: "KT",
    domain: "kt.com",
    ownerEmail: "thrishank@kt.com",
    ownerUsername: "thrishank"
};

const departments = [
    { name: "Engineering", managerName: "preethi", managerEmail: "preethi@kt.com" },
    { name: "Design", managerName: "lily", managerEmail: "lily@kt.com" },
    { name: "Testing", managerName: "reddy", managerEmail: "reddy@kt.com" },
    { name: "HR", managerName: "uday", managerEmail: "uday@kt.com" }
];

const usersData = [
    { username: "akash", email: "akash@kt.com", dept: "Design" },
    { username: "anil", email: "anil@kt.com", dept: "Testing" },
    { username: "anjali", email: "anjali@kt.com", dept: "Design" },
    { username: "arjun", email: "arjun@kt.com", dept: "Engineering" },
    { username: "deepa", email: "deepa@kt.com", dept: "HR" },
    { username: "divya", email: "divya@kt.com", dept: "Design" },
    { username: "kavya", email: "kavya@kt.com", dept: "Engineering" },
    { username: "kiran", email: "kiran@kt.com", dept: "HR" },
    { username: "lily", email: "lily@kt.com", dept: "Design", role: "admin" }, // Manager/Admin
    { username: "meera", email: "meera@kt.com", dept: "HR" },
    { username: "pooja", email: "pooja@kt.com", dept: "Testing" },
    { username: "preethi", email: "preethi@kt.com", dept: "Engineering", role: "admin" }, // Manager/Admin
    { username: "priya", email: "priya@kt.com", dept: "Engineering" },
    { username: "ravi", email: "ravi@kt.com", dept: "HR" },
    { username: "reddy", email: "reddy@kt.com", dept: "Testing", role: "admin" }, // Manager/Admin
    { username: "rohan", email: "rohan@kt.com", dept: "Design" },
    { username: "sanjay", email: "sanjay@kt.com", dept: "Engineering" },
    { username: "sneha", email: "sneha@kt.com", dept: "Testing" },
    { username: "uday", email: "uday@kt.com", dept: "HR", role: "admin" }, // Manager/Admin
    { username: "vinay", email: "vinay@kt.com", dept: "Testing" }
];

const seedKT = async () => {
    try {
        console.log("🌱 Seeding KT Company...");
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // 1. Create Owner User
        console.log("Creating Owner...");
        const passwordHash = await bcrypt.hash("password123", 10); // Standard password

        let owner = await User.findOne({ email: companyData.ownerEmail });
        if (!owner) {
            owner = await User.create({
                username: companyData.ownerUsername,
                email: companyData.ownerEmail,
                passwordHash,
                userType: "company",
                companyRole: "owner",
                isCoOwner: true,
                verified: true,
                isOnline: false,
                profile: { name: companyData.ownerUsername }
            });
        }

        // 2. Create Company
        console.log("Creating Company...");
        let company = await Company.findOne({ domain: companyData.domain });
        if (!company) {
            company = await Company.create({
                name: companyData.name,
                domain: companyData.domain,
                isActive: true,
                admins: [{ user: owner._id, role: "owner" }],
                verificationStatus: "verified",
                isSetupComplete: true,
                invitePolicy: { requireInvite: false } // Open for seeding
            });
        }

        // Link owner to company
        owner.companyId = company._id;
        await owner.save();

        // 3. Create Departments and Corresponding Workspaces
        const deptMap = {}; // name -> Department Document
        const workspaceMap = {}; // name -> Workspace Document

        for (const deptDef of departments) {
            console.log(`Creating Department: ${deptDef.name}`);

            // Create Department
            let department = await Department.create({
                company: company._id,
                name: deptDef.name,
                description: `${deptDef.name} Department`,
                isActive: true
            });
            deptMap[deptDef.name] = department;

            // Create Workspace (Each Dept gets a workspace per request structure)
            console.log(`Creating Workspace: ${deptDef.name}`);
            let workspace = await Workspace.create({
                company: company._id,
                type: "company",
                name: deptDef.name,
                description: `Workspace for ${deptDef.name}`,
                createdBy: owner._id,
                members: [{ user: owner._id, role: "owner" }], // Owner is always partial member/owner
                settings: { isPrivate: false } // Open for department members
            });
            workspaceMap[deptDef.name] = workspace;

            // Link workspace to department
            department.workspaces.push(workspace._id);
            await department.save();

            // Create Default Channels for Workspace
            const generalChannel = await Channel.create({
                workspace: workspace._id,
                company: company._id,
                name: "general",
                isDefault: true,
                createdBy: owner._id,
                members: [{ user: owner._id }]
            });
            const announcementsChannel = await Channel.create({
                workspace: workspace._id,
                company: company._id,
                name: "announcements",
                isDefault: true,
                createdBy: owner._id,
                members: [{ user: owner._id }]
            });
            workspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
            await workspace.save();
        }

        // 4. Create Users and Assign to Departments/Workspaces
        console.log("Creating Users...");

        for (const userData of usersData) {
            let user = await User.findOne({ email: userData.email });
            if (!user) {
                user = await User.create({
                    username: userData.username,
                    email: userData.email,
                    passwordHash,
                    userType: "company",
                    companyId: company._id,
                    companyRole: userData.role === "admin" ? "manager" : "member", // Managers are managers in company role
                    verified: true,
                    profile: { name: userData.username }
                });
            }

            const dept = deptMap[userData.dept];
            const workspace = workspaceMap[userData.dept];

            // Add to Department
            if (dept) {
                user.departments.push(dept._id);
                // If Manager
                if (departments.some(d => d.name === userData.dept && d.managerEmail === userData.email)) {
                    console.log(`Assigning ${user.username} as Head of ${userData.dept}`);
                    dept.head = user._id;
                    await dept.save();
                    user.managedDepartments.push(dept._id);
                }
                dept.members.push(user._id);
                await dept.save();
            }

            // Add to Workspace
            if (workspace) {
                const role = userData.role === "admin" ? "admin" : "member";

                // Add to workspace members
                workspace.members.push({
                    user: user._id,
                    role: role,
                    joinedAt: new Date()
                });
                await workspace.save();

                // Add to user workspaces
                user.workspaces.push({
                    workspace: workspace._id,
                    role: role
                });

                // Add to default channels
                const defaultChannels = await Channel.find({ workspace: workspace._id, isDefault: true });
                for (const channel of defaultChannels) {
                    channel.members.push({ user: user._id, joinedAt: new Date() });
                    await channel.save();
                }
            }

            await user.save();
            console.log(`Processed User: ${user.username}`);
        }

        console.log("Seeding Completed Successfully! 🌱");
        process.exit(0);

    } catch (err) {
        console.error("Seeding Failed:", err);
        process.exit(1);
    }
};

seedKT();
