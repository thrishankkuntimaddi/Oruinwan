const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Company = require('../models/Company');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const Task = require('../models/Task');
const Billing = require('../models/Billing');
const AuditLog = require('../models/AuditLog');

const DEFAULT_PASSWORD = 'Nani123@';

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

// Helper to hash password
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

// Clear database except platform admin
const clearDatabase = async () => {
    console.log('\n🗑️  Clearing database...');

    // Find platform admin (Chttrix admin) to preserve - check by email
    const platformAdmin = await User.findOne({ email: 'chttrix-admin@chttrix.com' });
    const platformAdminId = platformAdmin?._id;

    if (platformAdminId) {
        console.log(`   Preserving platform admin: ${platformAdmin.email}`);
    } else {
        console.log('   ⚠️  Platform admin not found - will need to be recreated');
    }

    // Delete everything except platform admin
    await User.deleteMany(platformAdminId ? { _id: { $ne: platformAdminId } } : {});
    await Company.deleteMany({});
    await Department.deleteMany({});
    await Workspace.deleteMany({});
    await Channel.deleteMany({});
    await Message.deleteMany({});
    await Task.deleteMany({});
    await Billing.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('✅ Database cleared (platform admin preserved)');
};

// Seed data
const seedDatabase = async () => {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    console.log('\n🌱 Seeding database...\n');

    // ============ 1. CREATE COMPANY ============
    console.log('📊 Creating company...');
    const company = await Company.create({
        name: 'Venkateshwara Technologies',
        displayName: 'VenkaTech',
        domain: 'venkatech.com',
        domainVerified: true,
        verificationStatus: 'verified',
        isSetupComplete: true,
        setupStep: 4,
        plan: 'professional',
        settings: {
            maxUsers: 100,
            maxWorkspaces: 50,
            allowMemberWorkspaceCreation: false,
            timezone: 'Asia/Kolkata'
        }
    });
    console.log(`   ✅ Company created: ${company.name}`);

    // ============ 2. CREATE BILLING ============
    const billing = await Billing.create({
        companyId: company._id,
        plan: 'professional',
        amount: 4999,
        billingCycle: 'monthly',
        status: 'active',
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // ============ 3. CREATE OWNER ============
    console.log('\n👑 Creating owner...');
    const owner = await User.create({
        username: 'Lakshmi Narayanan',
        email: 'lakshmi.narayanan@venkatech.com',
        passwordHash,
        companyId: company._id,
        companyRole: 'owner',
        jobTitle: 'CEO & Founder',
        verified: true,
        accountStatus: 'active',
        profile: { name: 'Lakshmi Narayanan', about: 'Founder and CEO of VenkaTech' }
    });
    console.log(`   ✅ Owner: ${owner.email}`);

    // Add owner to company admins
    company.admins.push({ user: owner._id, role: 'owner' });
    await company.save();

    // ============ 4. CREATE ADMINS ============
    console.log('\n🛡️  Creating admins...');
    const adminData = [
        { name: 'Venkatesh Subramaniam', email: 'venkatesh.subramaniam@venkatech.com', title: 'CTO' },
        { name: 'Priya Ramakrishnan', email: 'priya.ramakrishnan@venkatech.com', title: 'VP of Operations' }
    ];

    const admins = [];
    for (const data of adminData) {
        const admin = await User.create({
            username: data.name,
            email: data.email,
            passwordHash,
            companyId: company._id,
            companyRole: 'admin',
            jobTitle: data.title,
            verified: true,
            accountStatus: 'active',
            profile: { name: data.name }
        });
        admins.push(admin);
        company.admins.push({ user: admin._id, role: 'admin' });
        console.log(`   ✅ Admin: ${admin.email}`);
    }
    await company.save();

    // ============ 5. CREATE DEPARTMENTS ============
    console.log('\n🏢 Creating departments...');
    const deptData = [
        { name: 'Engineering', desc: 'Software development and infrastructure' },
        { name: 'Design', desc: 'Product design and user experience' },
        { name: 'Product', desc: 'Product management and strategy' },
        { name: 'QA & Testing', desc: 'Quality assurance and testing' },
        { name: 'DevOps', desc: 'DevOps and infrastructure automation' }
    ];

    const departments = [];
    for (const data of deptData) {
        const dept = await Department.create({
            company: company._id,
            name: data.name,
            description: data.desc,
            isActive: true
        });
        departments.push(dept);
        console.log(`   ✅ Department: ${dept.name}`);
    }

    // ============ 6. CREATE MANAGERS ============
    console.log('\n👔 Creating managers...');
    const managerData = [
        { name: 'Karthik Murugan', email: 'karthik.murugan@venkatech.com', title: 'Engineering Manager', dept: 0 },
        { name: 'Divya Krishnan', email: 'divya.krishnan@venkatech.com', title: 'Design Lead', dept: 1 },
        { name: 'Rajesh Balaji', email: 'rajesh.balaji@venkatech.com', title: 'Product Manager', dept: 2 },
        { name: 'Kavitha Sundaram', email: 'kavitha.sundaram@venkatech.com', title: 'QA Manager', dept: 3 }
    ];

    const managers = [];
    for (const data of managerData) {
        const manager = await User.create({
            username: data.name,
            email: data.email,
            passwordHash,
            companyId: company._id,
            companyRole: 'manager',
            jobTitle: data.title,
            departments: [departments[data.dept]._id],
            managedDepartments: [departments[data.dept]._id],
            verified: true,
            accountStatus: 'active',
            profile: { name: data.name }
        });
        managers.push(manager);

        // Add to department
        departments[data.dept].managers.push(manager._id);
        departments[data.dept].head = manager._id;
        await departments[data.dept].save();

        console.log(`   ✅ Manager: ${manager.email} → ${departments[data.dept].name}`);
    }

    // ============ 7. CREATE EMPLOYEES ============
    console.log('\n👥 Creating employees...');
    const employeeNames = [
        'Aravind Selvam', 'Meera Rajan', 'Santhosh Kumar', 'Deepika Iyer',
        'Vijay Kannan', 'Anjali Nair', 'Manoj Reddy', 'Sowmya Venkat',
        'Prakash Subramanian', 'Ramya Gopalan', 'Ashok Pillai', 'Nandhini Shankar',
        'Suresh Natarajan', 'Mythili Arun', 'Ganesh Ravi', 'Bhavani Swaminathan',
        'Harish Balasubramanian', 'Keerthi Murthy', 'Naveen Srinivasan', 'Pavithra Ramesh'
    ];

    const employees = [];
    for (let i = 0; i < 20; i++) {
        const name = employeeNames[i];
        const email = name.toLowerCase().replace(' ', '.') + '@techcorp.com';
        const deptIndex = i % 5; // Distribute across 5 departments

        const employee = await User.create({
            username: name,
            email,
            passwordHash,
            companyId: company._id,
            companyRole: 'member',
            jobTitle: ['Senior Engineer', 'Engineer', 'Designer', 'QA Engineer', 'DevOps Engineer'][deptIndex],
            departments: [departments[deptIndex]._id],
            verified: true,
            accountStatus: 'active',
            profile: { name }
        });
        employees.push(employee);

        departments[deptIndex].members.push(employee._id);
        await departments[deptIndex].save();

        console.log(`   ✅ Employee: ${employee.email} → ${departments[deptIndex].name}`);
    }

    // ============ 8. CREATE GUESTS ============
    console.log('\n🎫 Creating guests...');
    const guestData = [
        { name: 'Consultant Ramachandran', email: 'ramachandran@consulting.com' },
        { name: 'Contractor Vishnu', email: 'vishnu.contractor@external.com' },
        { name: 'Partner Saravanan', email: 'saravanan@partner.com' },
        { name: 'Freelance Designer Yamini', email: 'yamini@freelance.design' },
        { name: 'Auditor Shanmugam', email: 'shanmugam@audit.firm' }
    ];

    const guests = [];
    for (const data of guestData) {
        const guest = await User.create({
            username: data.name,
            email: data.email,
            passwordHash,
            companyId: company._id,
            companyRole: 'guest',
            jobTitle: 'External Collaborator',
            verified: true,
            accountStatus: 'active',
            profile: { name: data.name }
        });
        guests.push(guest);
        console.log(`   ✅ Guest: ${guest.email}`);
    }

    // ============ 9. CREATE WORKSPACES ============
    console.log('\n🗂️  Creating workspaces...');
    const workspaceData = [
        { name: 'Fireworks App', desc: 'Mobile app development', dept: 0, mgr: 0 },
        { name: 'UPI Integration', desc: 'Payment gateway integration', dept: 0, mgr: 0 },
        { name: 'Payments Backend', desc: 'Payment processing system', dept: 0, mgr: 0 },
        { name: 'Design System', desc: 'Component library and design tokens', dept: 1, mgr: 1 },
        { name: 'Mobile App Redesign', desc: 'UI/UX refresh project', dept: 1, mgr: 1 },
        { name: 'Product Roadmap Q1', desc: 'Q1 2026 feature planning', dept: 2, mgr: 2 },
        { name: 'User Research', desc: 'Customer insights and feedback', dept: 2, mgr: 2 },
        { name: 'Automation Testing', desc: 'E2E test automation framework', dept: 3, mgr: 3 },
        { name: 'Infrastructure', desc: 'Cloud infrastructure and DevOps', dept: 4, mgr: 0 },
        { name: 'Security Audit', desc: 'Security compliance and audits', dept: 3, mgr: 3 }
    ];

    const workspaces = [];
    for (const data of workspaceData) {
        const managerUser = managers[data.mgr];
        const dept = departments[data.dept];

        const workspace = await Workspace.create({
            company: company._id,
            type: 'company',
            name: data.name,
            description: data.desc,
            department: dept._id,
            createdBy: managerUser._id,
            members: [
                { user: owner._id, role: 'owner', status: 'active' },
                { user: managerUser._id, role: 'admin', status: 'active' }
            ],
            settings: {
                isPrivate: false,
                allowMemberInvite: true,
                allowMemberChannelCreation: true
            }
        });

        // Add employees from the same department
        const deptEmployees = employees.filter(e =>
            e.departments.some(d => d.toString() === dept._id.toString())
        );

        // Add 2-4 employees per workspace
        const membersToAdd = deptEmployees.slice(0, 2 + Math.floor(Math.random() * 3));
        for (const emp of membersToAdd) {
            workspace.members.push({ user: emp._id, role: 'member', status: 'active' });
            emp.workspaces.push({ workspace: workspace._id, role: 'member' });
            emp.assignedWorkspaces.push(workspace._id);
            await emp.save();
        }

        // Add 1-2 guests to some workspaces
        if (Math.random() > 0.5 && guests.length > 0) {
            const guest = guests[Math.floor(Math.random() * guests.length)];
            workspace.members.push({ user: guest._id, role: 'member', status: 'active' });
            guest.workspaces.push({ workspace: workspace._id, role: 'member' });
            guest.assignedWorkspaces.push(workspace._id);
            await guest.save();
        }

        await workspace.save();

        // Update manager's workspaces
        managerUser.workspaces.push({ workspace: workspace._id, role: 'admin' });
        managerUser.assignedWorkspaces.push(workspace._id);
        await managerUser.save();

        workspaces.push(workspace);
        console.log(`   ✅ Workspace: ${workspace.name} (${workspace.members.length} members)`);

        // Create default channels
        const generalChannel = await Channel.create({
            workspace: workspace._id,
            company: company._id,
            name: 'general',
            description: 'General discussion',
            isDefault: true,
            isPrivate: false,
            createdBy: managerUser._id,
            members: workspace.members.map(m => ({ user: m.user, joinedAt: new Date() }))
        });

        workspace.defaultChannels.push(generalChannel._id);
        await workspace.save();
    }

    // ============ 10. CREATE SAMPLE MESSAGES ============
    console.log('\n💬 Creating sample messages...');
    let messageCount = 0;
    for (const workspace of workspaces.slice(0, 5)) { // First 5 workspaces
        const channel = await Channel.findOne({ workspace: workspace._id, name: 'general' });
        if (!channel) continue;

        const wsMembers = workspace.members.map(m => m.user);
        const numMessages = 10 + Math.floor(Math.random() * 20);

        for (let i = 0; i < numMessages; i++) {
            const sender = wsMembers[Math.floor(Math.random() * wsMembers.length)];
            const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days

            await Message.create({
                company: company._id,
                workspace: workspace._id,
                channel: channel._id,
                sender,
                text: `Sample message ${i + 1} in ${workspace.name}`,
                createdAt
            });
            messageCount++;
        }
    }
    console.log(`   ✅ Created ${messageCount} sample messages`);

    // ============ 11. CREATE SAMPLE TASKS ============
    console.log('\n✅ Creating sample tasks...');
    let taskCount = 0;
    for (const workspace of workspaces) {
        const wsMembers = workspace.members.filter(m => m.role !== 'owner').map(m => m.user);
        if (wsMembers.length === 0) continue;

        const numTasks = 5 + Math.floor(Math.random() * 10);
        const statuses = ['backlog', 'todo', 'in_progress', 'review', 'done'];

        for (let i = 0; i < numTasks; i++) {
            const assignee = wsMembers[Math.floor(Math.random() * wsMembers.length)];
            const creator = workspace.members[0].user; // Manager creates tasks
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            await Task.create({
                company: company._id,
                workspace: workspace._id,
                title: `Task ${i + 1}: ${workspace.name}`,
                description: 'Sample task for testing',
                createdBy: creator,
                assignedTo: [assignee],
                status,
                visibility: 'workspace',
                priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000)
            });
            taskCount++;
        }
    }
    console.log(`   ✅ Created ${taskCount} sample tasks`);

    // ============ SUMMARY ============
    console.log('\n\n📊 DATABASE SEED SUMMARY');
    console.log('========================');
    console.log(`Company: ${company.name}`);
    console.log(`Owner: ${owner.email}`);
    console.log(`Admins: ${admins.length}`);
    console.log(`Managers: ${managers.length}`);
    console.log(`Employees: ${employees.length}`);
    console.log(`Guests: ${guests.length}`);
    console.log(`Departments: ${departments.length}`);
    console.log(`Workspaces: ${workspaces.length}`);
    console.log(`Messages: ${messageCount}`);
    console.log(`Tasks: ${taskCount}`);
    console.log(`\n🔑 Default password for all users: ${DEFAULT_PASSWORD}`);
    console.log('\n✅ Database seeding complete!\n');
};

// Main execution
const main = async () => {
    await connectDB();
    await clearDatabase();
    await seedDatabase();
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
};

main().catch(err => {
    console.error('❌ Seed script error:', err);
    process.exit(1);
});
