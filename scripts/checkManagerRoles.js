// Script to check manager roles and fix the issue
console.log('🚀 Starting manager role check script...');
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');

async function checkAndFix() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        console.log('Using MongoDB URI:', mongoUri);
        await mongoose.connect(mongoUri);

        console.log('✅ Connected to MongoDB');

        // Find all users with managedDepartments
        const managersWithDepts = await User.find({
            managedDepartments: { $exists: true, $ne: [] }
        }).select('username email companyRole managedDepartments');

        console.log('\n📊 Users with Managed Departments:');
        console.log('='.repeat(80));

        for (const user of managersWithDepts) {
            console.log(`${user.username} (${user.email})`);
            console.log(`  - Current Role: ${user.companyRole}`);
            console.log(`  - Managed Departments: ${user.managedDepartments.length} department(s)`);
            console.log(`  - Department IDs: ${user.managedDepartments.join(', ')}`);
            console.log('');
        }

        // Check all departments and their heads
        const departments = await Department.find({}).populate('head', 'username email companyRole');

        console.log('\n📂 Department Information:');
        console.log('='.repeat(80));

        for (const dept of departments) {
            console.log(`${dept.name}`);
            if (dept.head) {
                console.log(`  - Head: ${dept.head.username} (${dept.head.email})`);
                console.log(`  - Head Role: ${dept.head.companyRole}`);
            } else {
                console.log(`  - Head: Not assigned`);
            }
            console.log('');
        }

        // Now fix the issue - users with managedDepartments should have companyRole='manager'
        console.log('\n🔧 Fixing Manager Roles...');
        console.log('='.repeat(80));

        for (const user of managersWithDepts) {
            if (user.companyRole === 'member' || user.companyRole !== 'manager') {
                await User.findByIdAndUpdate(user._id, { companyRole: 'manager' });
                console.log(`✅ Updated ${user.username} role from '${user.companyRole}' to 'manager'`);
            } else {
                console.log(`ℹ️ ${user.username} already has the correct role: ${user.companyRole}`);
            }
        }

        console.log('\n✅ Done!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

checkAndFix();
