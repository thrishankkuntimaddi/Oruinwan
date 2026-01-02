// Test script to verify MM company data
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Company = require('../models/Company');

async function testDashboardData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected\n');

        // Find MM company
        const mmCompany = await Company.findOne({ name: 'MM' });
        if (!mmCompany) {
            console.log('❌ MM company not found');
            process.exit(1);
        }

        console.log(`📊 MM Company ID: ${mmCompany._id}\n`);

        // Test the exact queries from dashboardController
        const totalUsers = await User.countDocuments({ companyId: mmCompany._id });
        const workspaces = await Workspace.find({ company: mmCompany._id }).lean();

        console.log('Dashboard Metrics:');
        console.log(`  Total Users: ${totalUsers}`);
        console.log(`  Total Workspaces: ${workspaces.length}`);
        console.log('');

        if (workspaces.length > 0) {
            console.log('Workspaces:');
            workspaces.forEach(ws => {
                console.log(`  - ${ws.name} (${ws.members?.length || 0} members)`);
            });
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

testDashboardData();
