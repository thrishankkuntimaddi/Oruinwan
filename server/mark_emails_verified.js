const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');
require('dotenv').config({ path: './.env' });

async function verifyAllEmails() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find KT company
        const company = await Company.findOne({ name: 'KT' });
        if (!company) {
            console.error('❌ Company "KT" not found!');
            process.exit(1);
        }

        console.log('═'.repeat(80));
        console.log(`📦 Company: ${company.name}`);
        console.log(`🆔 Company ID: ${company._id}`);
        console.log('═'.repeat(80));
        console.log('');

        // Find all users for this company
        const users = await User.find({ companyId: company._id });

        console.log(`📧 Marking ${users.length} user emails as verified...`);
        console.log('─'.repeat(80));
        console.log('');

        let updatedCount = 0;
        for (const user of users) {
            // Mark email as verified
            user.verified = true;

            // Also update the emails array if it exists
            if (user.emails && user.emails.length > 0) {
                user.emails.forEach(emailObj => {
                    emailObj.verified = true;
                });
            }

            await user.save();
            updatedCount++;
            console.log(`   ${updatedCount}. ✓ ${user.email} verified`);
        }

        console.log('');
        console.log('═'.repeat(80));
        console.log('✅ EMAIL VERIFICATION COMPLETE!');
        console.log('═'.repeat(80));
        console.log('');
        console.log(`📊 Summary:`);
        console.log(`   • Total users processed: ${updatedCount}`);
        console.log(`   • All emails marked as verified`);
        console.log(`   • Users can now login without email verification`);
        console.log('');

    } catch (error) {
        console.error('\n❌ Error verifying emails:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB\n');
    }
}

verifyAllEmails();
