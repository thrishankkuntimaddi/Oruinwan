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

    const platformAdmin = await User.findOne({ email: 'chttrix-admin@chttrix.com' });
    const platformAdminId = platformAdmin?._id;

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
    const company = await Company.create({
        name: 'KT Technologies',
        displayName: 'KT Tech',
        domain: 'kt.com',
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

    // ============ 2. CREATE BILLING ============
    await Billing.create({
        companyId: company._id,
        plan: 'professional',
        amount: 4999,
        billingCycle: 'monthly',
        status: 'active',
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // ============ 3. CREATE OWNER ============
    const owner = await User.create({
        username: 'Lakshmi Narayanan',
        email: 'lakshmi.narayanan@kt.com',
        passwordHash,
        companyId: company._id,
        companyRole: 'owner',
        jobTitle: 'CEO & Founder',
        verified: true,
        accountStatus: 'active',
        profile: { name: 'Lakshmi Narayanan' }
    });

    company.admins.push({ user: owner._id, role: 'owner' });
    await company.save();

    // ============ 4. CREATE ADMINS ============
    const adminData = [
        { name: 'Venkatesh Subramaniam', email: 'venkatesh.subramaniam@kt.com', title: 'CTO' },
        { name: 'Priya Ramakrishnan', email: 'priya.ramakrishnan@kt.com', title: 'VP of Operations' }
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
    }
    await company.save();

    // ============ 5. CREATE DEPARTMENTS ============
    const deptData = [
        { name: 'Engineering', desc: 'Software development and infrastructure' },
        { name: 'Design', desc: 'Product design and user experience' },
        { name: 'Product', desc: 'Product management and strategy' },
        { name: 'QA & Testing', desc: 'Quality assurance and testing' },
        { name: 'DevOps', desc: 'DevOps and infrastructure automation' }
    ];

    const departments = [];
    for (const data of deptData) {
        departments.push(
            await Department.create({
                company: company._id,
                name: data.name,
                description: data.desc,
                isActive: true
            })
        );
    }

    // ============ 6. CREATE MANAGERS ============
    const managerData = [
        { name: 'Karthik Murugan', email: 'karthik.murugan@kt.com', title: 'Engineering Manager', dept: 0 },
        { name: 'Divya Krishnan', email: 'divya.krishnan@kt.com', title: 'Design Lead', dept: 1 },
        { name: 'Rajesh Balaji', email: 'rajesh.balaji@kt.com', title: 'Product Manager', dept: 2 },
        { name: 'Kavitha Sundaram', email: 'kavitha.sundaram@kt.com', title: 'QA Manager', dept: 3 }
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
        departments[data.dept].managers.push(manager._id);
        departments[data.dept].head = manager._id;
        await departments[data.dept].save();
    }

    // ============ 7. CREATE EMPLOYEES ============
    const employeeNames = [
        'Ramya Iyer', 'Priya Nair', 'Ravi Kumar', 'Meera Rajan',
        'Arjun Reddy', 'Kavya Menon', 'Suresh Babu', 'Ananya Sharma',
        'Vikram Singh', 'Pooja Patel', 'Nikhil Verma', 'Sneha Kulkarni',
        'Amit Shah', 'Divya Rao', 'Manoj Pillai', 'Keerthi Murthy',
        'Santosh Naik', 'Bhavya Jain', 'Harish Chandra', 'Neha Gupta'
    ];

    const employees = [];
    for (let i = 0; i < employeeNames.length; i++) {
        const name = employeeNames[i];
        const email = name.toLowerCase().replace(/\s+/g, '.') + '@kt.com';
        const deptIndex = i % 5;

        const employee = await User.create({
            username: name,
            email,
            passwordHash,
            companyId: company._id,
            companyRole: 'member',
            jobTitle: ['Engineer', 'Designer', 'Product Specialist', 'QA Engineer', 'DevOps Engineer'][deptIndex],
            departments: [departments[deptIndex]._id],
            verified: true,
            accountStatus: 'active',
            profile: { name }
        });

        employees.push(employee);
        departments[deptIndex].members.push(employee._id);
        await departments[deptIndex].save();
    }

    // ============ 8. CREATE GUESTS ============
    const guestData = [
        { name: 'Consultant Ramachandran', email: 'ramachandran@consulting.com' },
        { name: 'Contractor Vishnu', email: 'vishnu.contractor@external.com' },
        { name: 'Partner Saravanan', email: 'saravanan@partner.com' },
        { name: 'Freelance Designer Yamini', email: 'yamini@freelance.design' },
        { name: 'Auditor Shanmugam', email: 'shanmugam@audit.firm' }
    ];

    const guests = [];
    for (const data of guestData) {
        guests.push(
            await User.create({
                username: data.name,
                email: data.email,
                passwordHash,
                companyId: company._id,
                companyRole: 'guest',
                jobTitle: 'External Collaborator',
                verified: true,
                accountStatus: 'active',
                profile: { name: data.name }
            })
        );
    }

    // ============ 9. CREATE WORKSPACES ============
    const workspaceData = [
        { name: 'Fireworks App', dept: 0, mgr: 0 },
        { name: 'UPI Integration', dept: 0, mgr: 0 },
        { name: 'Payments Backend', dept: 0, mgr: 0 },
        { name: 'Design System', dept: 1, mgr: 1 },
        { name: 'Mobile App Redesign', dept: 1, mgr: 1 },
        { name: 'Product Roadmap Q1', dept: 2, mgr: 2 },
        { name: 'User Research', dept: 2, mgr: 2 },
        { name: 'Automation Testing', dept: 3, mgr: 3 },
        { name: 'Infrastructure', dept: 4, mgr: 0 },
        { name: 'Security Audit', dept: 3, mgr: 3 }
    ];

    for (const data of workspaceData) {
        const manager = managers[data.mgr];
        const dept = departments[data.dept];

        const workspace = await Workspace.create({
            company: company._id,
            type: 'company',
            name: data.name,
            department: dept._id,
            createdBy: manager._id,
            members: [
                { user: owner._id, role: 'owner', status: 'active' },
                { user: manager._id, role: 'admin', status: 'active' }
            ]
        });

        await Channel.create({
            workspace: workspace._id,
            company: company._id,
            name: 'general',
            isDefault: true,
            createdBy: manager._id,
            members: workspace.members.map(m => ({ user: m.user }))
        });
    }

    console.log('\n✅ Database seeding complete!');
    console.log(`🔑 Default password for all users: ${DEFAULT_PASSWORD}`);
};

// Main execution
const main = async () => {
    await connectDB();
    await clearDatabase();
    await seedDatabase();
    await mongoose.connection.close();
    process.exit(0);
};

main().catch(err => {
    console.error('❌ Seed script error:', err);
    process.exit(1);
});
