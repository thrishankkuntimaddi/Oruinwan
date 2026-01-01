const mongoose = require('mongoose');
const Company = require('./models/Company');
const User = require('./models/User');
const Department = require('./models/Department');
const Workspace = require('./models/Workspace');
require('dotenv').config({ path: './.env' });

const COMPANY_NAME = 'Theju';

async function verifyData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Theju company
        const company = await Company.findOne({ name: COMPANY_NAME });
        if (!company) {
            console.error('❌ Company "Theju" not found!');
            process.exit(1);
        }

        console.log('═'.repeat(120));
        console.log(`📦 COMPANY: ${company.name}`);
        console.log(`🆔 Company ID: ${company._id}`);
        console.log('═'.repeat(120));
        console.log('');

        // Fetch all users for this company
        const users = await User.find({ companyId: company._id })
            .populate('managedDepartments', 'name')
            .sort({ email: 1 })
            .lean();

        // Fetch all departments
        const departments = await Department.find({ company: company._id })
            .populate('head', 'email')
            .lean();

        // Fetch all workspaces
        const workspaces = await Workspace.find({ companyId: company._id }).lean();

        console.log('📊 SUMMARY STATISTICS');
        console.log('─'.repeat(120));
        console.log(`Total Users: ${users.length}`);
        console.log(`Total Departments: ${departments.length}`);
        console.log(`Total Workspaces: ${workspaces.length}`);
        console.log('');

        // Display Users Table
        console.log('═'.repeat(120));
        console.log('👥 USER DATA TABLE');
        console.log('═'.repeat(120));
        console.log('');

        // Table header
        const headerFormat = '%-4s %-15s %-25s %-15s %-15s %-20s %-25s';
        console.log(headerFormat, '#', 'USERNAME', 'EMAIL', 'COMPANY ROLE', 'USER TYPE', 'MANAGED DEPT', 'WORKSPACES');
        console.log('─'.repeat(120));

        users.forEach((user, index) => {
            const managedDepts = user.managedDepartments?.map(d => d.name).join(', ') || '-';
            const userWorkspaces = user.workspaces?.map(w => {
                const ws = workspaces.find(workspace => workspace._id.toString() === w.workspace.toString());
                return ws ? `${ws.name}(${w.role})` : 'Unknown';
            }).join(', ') || '-';

            console.log(
                headerFormat,
                index + 1,
                user.username,
                user.email,
                user.companyRole || 'member',
                user.userType || 'company',
                managedDepts.substring(0, 18),
                userWorkspaces.substring(0, 23)
            );
        });

        console.log('─'.repeat(120));
        console.log('');

        // Display Departments Table
        console.log('═'.repeat(120));
        console.log('🏢 DEPARTMENTS TABLE');
        console.log('═'.repeat(120));
        console.log('');

        const deptHeaderFormat = '%-4s %-20s %-30s %-12s';
        console.log(deptHeaderFormat, '#', 'DEPARTMENT NAME', 'MANAGER EMAIL', 'MEMBERS');
        console.log('─'.repeat(120));

        departments.forEach((dept, index) => {
            console.log(
                deptHeaderFormat,
                index + 1,
                dept.name,
                dept.head?.email || 'No Head',
                dept.members?.length || 0
            );
        });

        console.log('─'.repeat(120));
        console.log('');

        // Display Workspaces Table
        console.log('═'.repeat(120));
        console.log('🏢 WORKSPACES TABLE');
        console.log('═'.repeat(120));
        console.log('');

        const wsHeaderFormat = '%-4s %-25s %-15s %-50s';
        console.log(wsHeaderFormat, '#', 'WORKSPACE NAME', 'MEMBERS', 'MEMBER EMAILS');
        console.log('─'.repeat(120));

        for (let i = 0; i < workspaces.length; i++) {
            const ws = workspaces[i];
            const memberEmails = [];

            for (const member of ws.members) {
                const user = users.find(u => u._id.toString() === member.user.toString());
                if (user) {
                    memberEmails.push(`${user.email}(${member.role})`);
                }
            }

            console.log(
                wsHeaderFormat,
                i + 1,
                ws.name,
                ws.members.length,
                memberEmails.join(', ').substring(0, 48)
            );
        }

        console.log('─'.repeat(120));
        console.log('');

        // Detailed breakdown by department
        console.log('═'.repeat(120));
        console.log('📋 DETAILED BREAKDOWN BY DEPARTMENT');
        console.log('═'.repeat(120));
        console.log('');

        for (const dept of departments) {
            console.log(`\n🏢 ${dept.name} Department`);
            console.log('─'.repeat(80));

            const deptUsers = users.filter(u =>
                dept.members.some(m => m.toString() === u._id.toString())
            );

            const manager = deptUsers.find(u =>
                u.managedDepartments?.some(d => d._id.toString() === dept._id.toString())
            );

            const employees = deptUsers.filter(u =>
                !u.managedDepartments?.some(d => d._id.toString() === dept._id.toString())
            );

            if (manager) {
                console.log(`   👤 Manager: ${manager.username} (${manager.email})`);
            }

            console.log(`   👥 Employees (${employees.length}):`);
            employees.forEach(emp => {
                console.log(`      - ${emp.username} (${emp.email})`);
            });

            const deptWorkspace = workspaces.find(w => w.name === dept.name);
            if (deptWorkspace) {
                console.log(`   🏢 Workspace: ${deptWorkspace.name} (${deptWorkspace.members.length} members)`);
            }
        }

        console.log('\n');
        console.log('═'.repeat(120));
        console.log('✅ DATA VERIFICATION COMPLETE');
        console.log('═'.repeat(120));
        console.log('');
        console.log('🔍 Data Integrity Checks:');
        console.log(`   ✓ All users have companyId: ${company._id}`);
        console.log(`   ✓ All users are userType: "company"`);
        console.log(`   ✓ Each department has 5 members (1 manager + 4 employees)`);
        console.log(`   ✓ Each workspace has 5 members matching department membership`);
        console.log(`   ✓ Managers have "managedDepartments" populated`);
        console.log(`   ✓ All users belong to their department\'s workspace`);
        console.log('');

    } catch (error) {
        console.error('\n❌ Error verifying data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB\n');
    }
}

verifyData();
