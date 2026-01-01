const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');
require('dotenv').config({ path: './.env' });

async function verifyEmails() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find KT company
        const company = await Company.findOne({ name: 'KT' });
        if (!company) {
            console.error('❌ Company "KT" not found!');
            process.exit(1);
        }

        console.log('═'.repeat(100));
        console.log(`📦 Company: ${company.name}`);
        console.log(`🌐 Domain: ${company.domain}`);
        console.log(`🆔 Company ID: ${company._id}`);
        console.log('═'.repeat(100));
        console.log('');

        // Get all users for this company
        const users = await User.find({ companyId: company._id })
            .sort({ email: 1 })
            .select('username email userType companyRole managedDepartments')
            .lean();

        console.log(`📧 COMPLETE EMAIL LIST (${users.length} users)`);
        console.log('─'.repeat(100));
        console.log('');

        // Categorize emails
        const ktEmails = [];
        const otherEmails = [];

        users.forEach(user => {
            if (user.email.endsWith('@kt.com')) {
                ktEmails.push(user);
            } else {
                otherEmails.push(user);
            }
        });

        // Display all emails
        console.log('✅ Users with @kt.com emails:');
        console.log('─'.repeat(100));
        ktEmails.forEach((user, index) => {
            const role = user.managedDepartments && user.managedDepartments.length > 0 ? '(Manager)' : '(Employee)';
            console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${user.email.padEnd(25)} - ${user.username.padEnd(15)} ${role}`);
        });

        if (otherEmails.length > 0) {
            console.log('\n');
            console.log('❌ Users with OTHER email domains:');
            console.log('─'.repeat(100));
            otherEmails.forEach((user, index) => {
                console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${user.email.padEnd(25)} - ${user.username}`);
            });
        }

        console.log('\n');
        console.log('═'.repeat(100));
        console.log('📊 EMAIL VERIFICATION SUMMARY');
        console.log('═'.repeat(100));
        console.log(`   Total Users: ${users.length}`);
        console.log(`   ✅ @kt.com emails: ${ktEmails.length}`);
        console.log(`   ❌ Other domains: ${otherEmails.length}`);
        console.log('');

        if (otherEmails.length === 0) {
            console.log('   🎉 ALL EMAILS SUCCESSFULLY UPDATED TO @kt.com DOMAIN!');
        } else {
            console.log('   ⚠️  WARNING: Some emails still have different domains!');
        }

        console.log('');
        console.log('═'.repeat(100));
        console.log('');

        // Show manager emails specifically
        const managers = ktEmails.filter(u => u.managedDepartments && u.managedDepartments.length > 0);
        const employees = ktEmails.filter(u => !u.managedDepartments || u.managedDepartments.length === 0);

        console.log('👤 MANAGER LOGINS:');
        console.log('─'.repeat(100));
        managers.forEach(m => console.log(`   • ${m.email}`));

        console.log('\n');
        console.log('👥 SAMPLE EMPLOYEE LOGINS:');
        console.log('─'.repeat(100));
        employees.slice(0, 10).forEach(e => console.log(`   • ${e.email}`));
        if (employees.length > 10) {
            console.log(`   ... and ${employees.length - 10} more`);
        }

        console.log('\n');
        console.log('🔐 Password for all accounts: Nani123@');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error verifying emails:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB\n');
    }
}

verifyEmails();
