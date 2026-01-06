// Comprehensive Fix Script for Company Workspace Issues
// Fixes: 1. Channel naming (announcement -> announcements)
//        2. Links workspaces to departments (if they match by name)

require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');

async function fixCompanyHierarchy() {
    try {
        const dbUri = process.env.MONGO_URI;
        if (!dbUri) {
            console.error('❌ MONGO_URI not found in environment variables');
            process.exit(1);
        }

        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');
        console.log('='.repeat(80));

        let totalChannelsRenamed = 0;
        let totalDuplicatesRemoved = 0;
        let totalWorkspacesLinked = 0;

        // Get all companies
        const companies = await Company.find({});
        console.log(`\n📊 Processing ${companies.length} companies...\n`);

        for (const company of companies) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🏢 Company: ${company.name} (${company._id})`);

            // ===== FIX 1: Rename channels from 'announcement' to 'announcements' =====
            console.log(`\n📝 Step 1: Fixing channel names...`);

            const incorrectChannels = await Channel.find({
                company: company._id,
                name: 'announcement',
                isDefault: true
            });

            for (const channel of incorrectChannels) {
                // Check if workspace already has correct channel
                const existingCorrect = await Channel.findOne({
                    workspace: channel.workspace,
                    name: 'announcements',
                    isDefault: true
                });

                if (existingCorrect) {
                    console.log(`   ❌ Deleting duplicate 'announcement' channel for workspace ${channel.workspace}`);
                    await Channel.findByIdAndDelete(channel._id);
                    await Workspace.updateOne(
                        { _id: channel.workspace },
                        { $pull: { defaultChannels: channel._id } }
                    );
                    totalDuplicatesRemoved++;
                } else {
                    channel.name = 'announcements';
                    await channel.save();
                    console.log(`   ✅ Renamed channel to 'announcements' for workspace ${channel.workspace}`);
                    totalChannelsRenamed++;
                }
            }

            // ===== FIX 2: Link workspaces to departments =====
            console.log(`\n🔗 Step 2: Linking workspaces to departments...`);

            const departments = await Department.find({ company: company._id });
            const companyWorkspaces = await Workspace.find({
                company: company._id
            });

            for (const dept of departments) {
                // Find workspace(s) that match department name
                const matchingWorkspaces = companyWorkspaces.filter(ws => {
                    // Check if workspace name matches department name
                    // Or if workspace already has this department linked
                    return ws.name === dept.name ||
                        (ws.department && ws.department.toString() === dept._id.toString());
                });

                console.log(`\n   📁 Department: ${dept.name}`);
                console.log(`      Found ${matchingWorkspaces.length} matching workspace(s)`);

                for (const ws of matchingWorkspaces) {
                    // Link workspace to department if not already linked
                    if (!ws.department || ws.department.toString() !== dept._id.toString()) {
                        ws.department = dept._id;
                        await ws.save();
                        console.log(`      ✅ Linked workspace "${ws.name}" to department`);
                    }

                    // Add workspace to department's workspace list if not present
                    if (!dept.workspaces.includes(ws._id)) {
                        dept.workspaces.push(ws._id);
                        await dept.save();
                        console.log(`      ✅ Added workspace to department's workspace list`);
                        totalWorkspacesLinked++;
                    }
                }
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('\n✅ Fix Complete!');
        console.log(`\n📊 Summary:`);
        console.log(`   - Channels renamed: ${totalChannelsRenamed}`);
        console.log(`   - Duplicate channels removed: ${totalDuplicatesRemoved}`);
        console.log(`   - Workspaces linked to departments: ${totalWorkspacesLinked}`);
        console.log('');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Fix error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    fixCompanyHierarchy();
}

module.exports = fixCompanyHierarchy;
