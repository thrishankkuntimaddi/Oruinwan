const mongoose = require('mongoose');
const Company = require('./models/Company');
const User = require('./models/User');
require('dotenv').config({ path: './.env' });

const OLD_COMPANY_NAME = 'Theju';
const NEW_COMPANY_NAME = 'KT';
const OLD_DOMAIN = '@theju.com';
const NEW_DOMAIN = '@kt.com';

async function renameCompany() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Find the company
        const company = await Company.findOne({ name: OLD_COMPANY_NAME });
        if (!company) {
            console.error(`❌ Company "${OLD_COMPANY_NAME}" not found!`);
            process.exit(1);
        }

        console.log('═'.repeat(80));
        console.log(`📦 Found Company: ${company.name}`);
        console.log(`🆔 Company ID: ${company._id}`);
        console.log('═'.repeat(80));
        console.log('');

        // Step 2: Update company name and domain
        console.log('🔄 Updating company name and domain...');
        company.name = NEW_COMPANY_NAME;
        company.domain = 'kt.com';
        await company.save();
        console.log(`   ✓ Company name updated: ${OLD_COMPANY_NAME} → ${NEW_COMPANY_NAME}`);
        console.log(`   ✓ Company domain updated: ${company.domain}`);
        console.log('');

        // Step 3: Find all users with old domain emails
        const usersToUpdate = await User.find({
            companyId: company._id,
            email: { $regex: OLD_DOMAIN.replace('@', '\\@') + '$' }
        });

        console.log(`📧 Found ${usersToUpdate.length} users with ${OLD_DOMAIN} emails`);
        console.log('─'.repeat(80));
        console.log('');

        // Step 4: Update each user's email
        let updatedCount = 0;
        for (const user of usersToUpdate) {
            const oldEmail = user.email;
            const newEmail = user.email.replace(OLD_DOMAIN, NEW_DOMAIN);

            user.email = newEmail;
            await user.save();

            updatedCount++;
            console.log(`   ${updatedCount}. ${oldEmail} → ${newEmail}`);
        }

        console.log('');
        console.log('═'.repeat(80));
        console.log('✅ UPDATE COMPLETE!');
        console.log('═'.repeat(80));
        console.log('');
        console.log('📊 Summary:');
        console.log(`   • Company name: ${OLD_COMPANY_NAME} → ${NEW_COMPANY_NAME}`);
        console.log(`   • Company domain: kt.com`);
        console.log(`   • Users updated: ${updatedCount}`);
        console.log(`   • Email domain: ${OLD_DOMAIN} → ${NEW_DOMAIN}`);
        console.log('');
        console.log('🔐 All passwords remain: Nani123@');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error updating data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB\n');
    }
}

renameCompany();
