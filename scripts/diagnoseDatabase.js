// Database Diagnostic Script - Check Company Hierarchy
// Verifies: Companies -> Departments -> Workspaces -> Channels

require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');

async function diagnoseDatabase() {
    try {
        const dbUri = process.env.MONGO_URI;
        if (!dbUri) {
            console.error('❌ MONGO_URI not found in environment variables');
            process.exit(1);
        }

        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');
        console.log('='.repeat(80));

        // 1. Check Companies
        const companies = await Company.find({});
        console.log(`\n📊 COMPANIES: Found ${companies.length}`);

        for (const company of companies) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🏢 Company: ${company.name} (ID: ${company._id})`);
            console.log(`   Status: ${company.verificationStatus}`);
            console.log(`   Setup Complete: ${company.isSetupComplete}`);
            console.log(`   Default Workspace: ${company.defaultWorkspace || 'None'}`);

            // 2. Check Departments for this company
            const departments = await Department.find({ company: company._id })
                .populate('workspaces');

            console.log(`\n   📁 DEPARTMENTS: ${departments.length}`);

            if (departments.length === 0) {
                console.log('   ⚠️  WARNING: No departments found for this company!');
            }

            for (const dept of departments) {
                console.log(`\n   ├─ 📁 ${dept.name} (ID: ${dept._id})`);
                console.log(`   │   Members: ${dept.members.length}`);
                console.log(`   │   Workspaces: ${dept.workspaces.length}`);

                // 3. Check Workspaces for this department
                const workspaces = await Workspace.find({ department: dept._id });

                if (workspaces.length === 0) {
                    console.log(`   │   ⚠️  WARNING: No workspaces found for department "${dept.name}"!`);
                }

                for (const ws of workspaces) {
                    console.log(`\n   │   ├─ 💼 Workspace: ${ws.name} (ID: ${ws._id})`);
                    console.log(`   │   │   Type: ${ws.type}`);
                    console.log(`   │   │   Members: ${ws.members?.length || 0}`);
                    console.log(`   │   │   Default Channels in Workspace: ${ws.defaultChannels?.length || 0}`);

                    // 4. Check Channels for this workspace
                    const channels = await Channel.find({ workspace: ws._id });
                    console.log(`   │   │   Total Channels Found: ${channels.length}`);

                    if (channels.length === 0) {
                        console.log(`   │   │   ❌ ERROR: No channels found for workspace "${ws.name}"!`);
                    }

                    for (const channel of channels) {
                        const isDefault = channel.isDefault ? '🔒' : '';
                        console.log(`   │   │   ├─ #${channel.name} ${isDefault}`);
                        console.log(`   │   │   │   ID: ${channel._id}`);
                        console.log(`   │   │   │   Is Default: ${channel.isDefault}`);
                        console.log(`   │   │   │   Members: ${channel.members?.length || 0}`);
                        console.log(`   │   │   │   Private: ${channel.isPrivate}`);
                    }

                    // Check for channel naming issues
                    const hasGeneral = channels.some(c => c.name === 'general');
                    const hasAnnouncements = channels.some(c => c.name === 'announcements');
                    const hasAnnouncementSingular = channels.some(c => c.name === 'announcement');

                    console.log(`\n   │   │   📋 Channel Check:`);
                    console.log(`   │   │      ✓ #general: ${hasGeneral ? '✅' : '❌'}`);
                    console.log(`   │   │      ✓ #announcements: ${hasAnnouncements ? '✅' : '❌'}`);
                    if (hasAnnouncementSingular) {
                        console.log(`   │   │      ⚠️  #announcement (INCORRECT): ✅ - NEEDS RENAME!`);
                    }
                }
            }

            // Also check for company-level workspaces (not tied to departments)
            const companyWorkspaces = await Workspace.find({
                company: company._id,
                department: { $exists: false }
            });

            if (companyWorkspaces.length > 0) {
                console.log(`\n   📌 COMPANY-LEVEL WORKSPACES: ${companyWorkspaces.length}`);
                for (const ws of companyWorkspaces) {
                    console.log(`\n   ├─ 💼 ${ws.name} (ID: ${ws._id})`);

                    const channels = await Channel.find({ workspace: ws._id });
                    console.log(`   │   Channels: ${channels.length}`);

                    for (const channel of channels) {
                        console.log(`   │   ├─ #${channel.name} (Default: ${channel.isDefault})`);
                    }
                }
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('\n✅ Database diagnosis complete!\n');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Diagnostic error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    diagnoseDatabase();
}

module.exports = diagnoseDatabase;
