// Create Test Company "MM" with Complete Hierarchy
// Structure: 1 Owner + 4 Departments (each with 1 Manager + 4 Employees)

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const User = require('../models/User');

async function createMMCompany() {
    try {
        const dbUri = process.env.MONGO_URI;
        if (!dbUri) {
            console.error('❌ MONGO_URI not found');
            process.exit(1);
        }

        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');
        console.log('='.repeat(80));

        // Check if MM company already exists
        const existing = await Company.findOne({ name: 'MM' });
        if (existing) {
            console.log('⚠️  MM company already exists. Deleting...');
            // Delete all related data
            await User.deleteMany({ companyId: existing._id });
            await Department.deleteMany({ company: existing._id });
            await Workspace.deleteMany({ company: existing._id });
            await Channel.deleteMany({ company: existing._id });
            await Company.findByIdAndDelete(existing._id);
            console.log('✅ Old MM company deleted\n');
        }

        // 1️⃣ CREATE COMPANY
        console.log('📊 Step 1: Creating Company "MM"...');
        const company = new Company({
            name: 'MM',
            domain: 'mm.com',
            domainVerified: true,
            verificationStatus: 'verified',
            isSetupComplete: true,
            plan: 'professional'
        });
        await company.save();
        console.log(`✅ Company created: ${company._id}\n`);

        // 2️⃣ CREATE OWNER
        console.log('👑 Step 2: Creating Owner "Nani"...');
        const ownerPassword = await bcrypt.hash('Password123!', 10);
        const owner = new User({
            username: 'Nani',
            email: 'nani@mm.com',
            passwordHash: ownerPassword,
            userType: 'company',
            companyId: company._id,
            companyRole: 'owner',
            jobTitle: 'CEO',
            verified: true,
            verificationTokenHash: undefined, // No verification needed
            verificationTokenExpires: undefined,
            accountStatus: 'active',
            departments: [],
            workspaces: [],
            isActive: true
        });
        await owner.save();

        company.admins.push({ user: owner._id, role: 'owner' });
        await company.save();
        console.log(`✅ Owner created: ${owner.email}\n`);

        // 3️⃣ DEFINE DEPARTMENTS & THEIR MEMBERS
        const departments = [
            { name: 'Engineering', managerName: 'Alice', managerEmail: 'alice@mm.com' },
            { name: 'HR', managerName: 'Bob', managerEmail: 'bob@mm.com' },
            { name: 'Design', managerName: 'Charlie', managerEmail: 'charlie@mm.com' },
            { name: 'Testing', managerName: 'Diana', managerEmail: 'diana@mm.com' }
        ];

        const employeeNames = [
            'Emma', 'Frank', 'Grace', 'Henry',
            'Ivy', 'Jack', 'Kate', 'Leo',
            'Mia', 'Noah', 'Olivia', 'Peter',
            'Quinn', 'Rachel', 'Sam', 'Tina'
        ];

        let employeeIndex = 0;

        for (const dept of departments) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📁 Creating Department: ${dept.name}`);
            console.log('='.repeat(80));

            // 4️⃣ CREATE MANAGER
            console.log(`\n👔 Creating Manager: ${dept.managerName}...`);
            const managerPassword = await bcrypt.hash('Password123!', 10);
            const manager = new User({
                username: dept.managerName,
                email: dept.managerEmail,
                passwordHash: managerPassword,
                userType: 'company',
                companyId: company._id,
                companyRole: 'manager',
                jobTitle: `${dept.name} Manager`,
                verified: true,
                verificationTokenHash: undefined,
                verificationTokenExpires: undefined,
                accountStatus: 'active',
                departments: [],
                managedDepartments: [],
                workspaces: [],
                isActive: true
            });
            await manager.save();
            console.log(`✅ Manager created: ${manager.email}`);

            // 5️⃣ CREATE 4 EMPLOYEES FOR THIS DEPARTMENT
            console.log(`\n👥 Creating 4 Employees...`);
            const employees = [];
            for (let i = 0; i < 4; i++) {
                const empName = employeeNames[employeeIndex++];
                const empEmail = `${empName.toLowerCase()}@mm.com`;
                const empPassword = await bcrypt.hash('Password123!', 10);

                const employee = new User({
                    username: empName,
                    email: empEmail,
                    passwordHash: empPassword,
                    userType: 'company',
                    companyId: company._id,
                    companyRole: 'member',
                    jobTitle: `${dept.name} Member`,
                    verified: true,
                    verificationTokenHash: undefined,
                    verificationTokenExpires: undefined,
                    accountStatus: 'active',
                    departments: [],
                    workspaces: [],
                    isActive: true
                });
                await employee.save();
                employees.push(employee);
                console.log(`   ✅ Employee created: ${employee.email}`);
            }

            // 6️⃣ CREATE DEPARTMENT
            console.log(`\n📂 Creating Department "${dept.name}"...`);
            const department = new Department({
                company: company._id,
                name: dept.name,
                description: `${dept.name} Department`,
                head: manager._id,
                members: [manager._id, ...employees.map(e => e._id)]
            });
            await department.save();
            console.log(`✅ Department created: ${department._id}`);

            // Update users with department
            manager.departments.push(department._id);
            manager.managedDepartments.push(department._id);
            await manager.save();

            for (const emp of employees) {
                emp.departments.push(department._id);
                await emp.save();
            }

            // 7️⃣ CREATE WORKSPACE (Same name as department)
            console.log(`\n💼 Creating Workspace "${dept.name}"...`);
            const workspace = new Workspace({
                company: company._id,
                department: department._id,
                type: 'company',
                name: dept.name,
                description: `${dept.name} Team Workspace`,
                createdBy: owner._id,
                members: [
                    { user: manager._id, role: 'admin', joinedAt: new Date() },
                    ...employees.map(e => ({ user: e._id, role: 'member', joinedAt: new Date() }))
                ],
                settings: {
                    isPrivate: false,
                    allowMemberInvite: true
                }
            });
            await workspace.save();
            console.log(`✅ Workspace created: ${workspace._id}`);

            // 8️⃣ CREATE DEFAULT CHANNELS (#general and #announcements)
            console.log(`\n📢 Creating Default Channels...`);
            const allMembers = [manager._id, ...employees.map(e => e._id)];

            const generalChannel = new Channel({
                workspace: workspace._id,
                company: company._id,
                name: 'general',
                description: 'General discussion',
                isDefault: true,
                isPrivate: false,
                createdBy: owner._id,
                members: allMembers.map(userId => ({ user: userId, joinedAt: new Date() }))
            });
            await generalChannel.save();
            console.log(`   ✅ #general channel created (${allMembers.length} members)`);

            const announcementsChannel = new Channel({
                workspace: workspace._id,
                company: company._id,
                name: 'announcements',
                description: 'Team announcements',
                isDefault: true,
                isPrivate: false,
                createdBy: owner._id,
                members: allMembers.map(userId => ({ user: userId, joinedAt: new Date() }))
            });
            await announcementsChannel.save();
            console.log(`   ✅ #announcements channel created (${allMembers.length} members)`);

            // 9️⃣ LINK CHANNELS TO WORKSPACE
            workspace.defaultChannels = [generalChannel._id, announcementsChannel._id];
            await workspace.save();

            // 🔟 LINK WORKSPACE TO DEPARTMENT
            department.workspaces = [workspace._id];
            await department.save();

            // Update users with workspace
            manager.workspaces.push({ workspace: workspace._id, role: 'admin' });
            await manager.save();

            for (const emp of employees) {
                emp.workspaces.push({ workspace: workspace._id, role: 'member' });
                await emp.save();
            }

            console.log(`✅ Department "${dept.name}" setup complete!`);
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('✅ MM COMPANY SETUP COMPLETE!\n');
        console.log('📊 Summary:');
        console.log(`   - Company: MM (mm.com)`);
        console.log(`   - Owner: Nani (nani@mm.com)`);
        console.log(`   - Departments: 4`);
        console.log(`   - Managers: 4 (1 per department)`);
        console.log(`   - Employees: 16 (4 per department)`);
        console.log(`   - Workspaces: 4 (1 per department)`);
        console.log(`   - Channels: 8 (2 per workspace)`);
        console.log(`   - Total Users: 21 (1 owner + 4 managers + 16 employees)\n`);
        console.log('🔑 Login Credentials:');
        console.log(`   - All users: password is "Password123!"`);
        console.log(`   - Owner: nani@mm.com`);
        console.log(`   - Managers: alice@mm.com, bob@mm.com, charlie@mm.com, diana@mm.com`);
        console.log(`   - Employees: emma@mm.com, frank@mm.com, grace@mm.com, etc.\n`);

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createMMCompany();
}

module.exports = createMMCompany;
