const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Company = require('./models/Company');
const User = require('./models/User');
const Department = require('./models/Department');
const Workspace = require('./models/Workspace');
require('dotenv').config({ path: './.env' });

const COMPANY_NAME = 'Theju';
const DEFAULT_PASSWORD = 'Nani123@';

const departmentsData = [
    { name: 'Engineering', manager: 'Preethi', managerEmail: 'preethi@theju.com' },
    { name: 'HR', manager: 'Uday', managerEmail: 'uday@theju.com' },
    { name: 'Testing', manager: 'Reddy', managerEmail: 'reddy@theju.com' },
    { name: 'Design', manager: 'Lily', managerEmail: 'lily@theju.com' }
];

const employeesPerDepartment = [
    ['Arjun', 'Priya', 'Sanjay', 'Kavya'],
    ['Meera', 'Ravi', 'Deepa', 'Kiran'],
    ['Anil', 'Pooja', 'Vinay', 'Sneha'],
    ['Rohan', 'Divya', 'Akash', 'Anjali']
];

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Theju company
        const company = await Company.findOne({ name: COMPANY_NAME });
        if (!company) {
            console.error('❌ Company "Theju" not found! Please create it first.');
            process.exit(1);
        }
        console.log(`📦 Found Company: ${company.name} (${company._id})\n`);

        // Cleanup existing test data for this company
        console.log('🧹 Cleaning up existing test data...');

        const testEmails = [
            ...departmentsData.map(d => d.managerEmail),
            ...employeesPerDepartment.flat().map((name, i) =>
                `${name.toLowerCase()}@theju.com`)
        ];

        const deletedUsers = await User.deleteMany({
            companyId: company._id,
            email: { $in: testEmails }
        });

        const deletedDepts = await Department.deleteMany({
            company: company._id,
            name: { $in: departmentsData.map(d => d.name) }
        });

        const deletedWorkspaces = await Workspace.deleteMany({
            companyId: company._id,
            name: { $in: departmentsData.map(d => d.name) }
        });

        console.log(`   ✓ Removed ${deletedUsers.deletedCount} users`);
        console.log(`   ✓ Removed ${deletedDepts.deletedCount} departments`);
        console.log(`   ✓ Removed ${deletedWorkspaces.deletedCount} workspaces\n`);

        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        const createdDepartments = [];
        const createdWorkspaces = [];
        const allUsers = [];

        // Create departments, managers, employees, and workspaces
        for (let i = 0; i < departmentsData.length; i++) {
            const deptData = departmentsData[i];
            console.log(`\n📁 Creating Department: ${deptData.name}`);
            console.log('─'.repeat(50));

            // 1. Create Manager
            console.log(`👤 Creating Manager: ${deptData.manager}`);
            const manager = new User({
                username: deptData.manager.toLowerCase(),
                email: deptData.managerEmail,
                passwordHash: hashedPassword,
                companyId: company._id,
                companyRole: 'member',
                userType: 'company',
                roles: ['user']
            });
            await manager.save();
            allUsers.push(manager);

            // 2. Create Department with Manager as head
            const department = new Department({
                company: company._id,
                name: deptData.name,
                description: `${deptData.name} Department`,
                head: manager._id,
                members: [manager._id]
            });
            await department.save();
            createdDepartments.push(department);

            // Update manager's managedDepartments
            manager.managedDepartments.push(department._id);
            await manager.save();

            console.log(`   ✓ Manager created: ${manager.email}`);
            console.log(`   ✓ Department created: ${department.name}`);

            // 3. Create 4 Employees for this department
            const deptEmployees = [];
            for (let j = 0; j < 4; j++) {
                const empName = employeesPerDepartment[i][j];
                const empEmail = `${empName.toLowerCase()}@theju.com`;

                const employee = new User({
                    username: empName.toLowerCase(),
                    email: empEmail,
                    passwordHash: hashedPassword,
                    companyId: company._id,
                    companyRole: 'member',
                    userType: 'company',
                    roles: ['user']
                });
                await employee.save();
                deptEmployees.push(employee);
                allUsers.push(employee);

                // Add employee to department
                department.members.push(employee._id);
            }
            await department.save();

            console.log(`   ✓ Created ${deptEmployees.length} employees`);
            deptEmployees.forEach(emp => console.log(`     - ${emp.email}`));

            // 4. Create Workspace for this department
            console.log(`🏢 Creating Workspace: ${deptData.name}`);
            const workspace = new Workspace({
                name: deptData.name,
                companyId: company._id,
                createdBy: manager._id,
                members: [
                    { user: manager._id, role: 'admin', joinedAt: new Date() },
                    ...deptEmployees.map(emp => ({ user: emp._id, role: 'member', joinedAt: new Date() }))
                ]
            });
            await workspace.save();
            createdWorkspaces.push(workspace);

            // Add workspace to all department members (manager + employees)
            const allDeptMembers = [manager, ...deptEmployees];
            for (const user of allDeptMembers) {
                user.workspaces.push({
                    workspace: workspace._id,
                    role: user._id.equals(manager._id) ? 'admin' : 'member',
                    joinedAt: new Date()
                });
                await user.save();
            }

            console.log(`   ✓ Workspace created with ${workspace.members.length} members`);
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('🎉 SEEDING COMPLETE!');
        console.log('='.repeat(50));
        console.log(`\n📊 Summary:`);
        console.log(`   • Company: ${company.name}`);
        console.log(`   • Departments: ${createdDepartments.length}`);
        console.log(`   • Workspaces: ${createdWorkspaces.length}`);
        console.log(`   • Total Users: ${allUsers.length} (4 managers + 16 employees)`);
        console.log(`   • Default Password: ${DEFAULT_PASSWORD}`);

        console.log(`\n📋 Department Breakdown:`);
        for (let i = 0; i < departmentsData.length; i++) {
            const dept = createdDepartments[i];
            console.log(`   ${dept.name}:`);
            console.log(`     - Manager: ${departmentsData[i].manager} (${departmentsData[i].managerEmail})`);
            console.log(`     - Employees: ${dept.members.length - 1}`);
            console.log(`     - Workspace: ${createdWorkspaces[i].name}`);
        }

        console.log(`\n🔑 Login Credentials:`);
        console.log(`   All accounts use password: ${DEFAULT_PASSWORD}`);
        console.log(`\n   Managers:`);
        departmentsData.forEach(d => console.log(`     - ${d.managerEmail}`));
        console.log(`\n   Example Employees:`);
        console.log(`     - arjun@theju.com (Engineering)`);
        console.log(`     - meera@theju.com (HR)`);
        console.log(`     - anil@theju.com (Testing)`);
        console.log(`     - rohan@theju.com (Design)`);

    } catch (error) {
        console.error('\n❌ Error seeding data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

seedData();
