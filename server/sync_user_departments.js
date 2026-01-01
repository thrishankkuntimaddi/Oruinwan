const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
require('dotenv').config({ path: './.env' });

async function syncDepartments() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Starting department sync...');
        const departments = await Department.find();
        console.log(`Found ${departments.length} departments.`);

        let updatedCount = 0;

        for (const dept of departments) {
            console.log(`\nProcessing Department: ${dept.name} (${dept.members.length} members)`);

            for (const memberId of dept.members) {
                // Update User to include this department
                const result = await User.updateOne(
                    { _id: memberId },
                    { $addToSet: { departments: dept._id } }
                );

                if (result.modifiedCount > 0) {
                    console.log(`   ✨ Updated user ${memberId} with department ${dept.name}`);
                    updatedCount++;
                }
            }
        }

        console.log(`\n✅ Sync complete! Updated ${updatedCount} user records.`);

    } catch (error) {
        console.error('❌ Sync failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected');
    }
}

syncDepartments();
