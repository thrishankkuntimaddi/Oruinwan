require('dotenv').config();
const mongoose = require('mongoose');
const DMSession = require('../models/DMSession');
const User = require('../models/User');

async function cleanupBrokenDMSessions() {
    try {
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        
        const allSessions = await DMSession.find({});
        console.log(`📊 Total DM sessions found: ${allSessions.length}`);

        let brokenCount = 0;
        const brokenSessions = [];

        
        for (const session of allSessions) {
            const participants = session.participants;

            
            const validParticipants = [];

            for (const participantId of participants) {
                const user = await User.findById(participantId);
                if (user) {
                    validParticipants.push(participantId);
                } else {
                    console.log(`❌ Invalid participant ${participantId} in session ${session._id}`);
                }
            }

            
            if (validParticipants.length < 2) {
                brokenCount++;
                brokenSessions.push(session._id);
                console.log(`🗑️  Broken session ${session._id} - Valid participants: ${validParticipants.length}/2`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total sessions: ${allSessions.length}`);
        console.log(`   Broken sessions: ${brokenCount}`);
        console.log(`   Healthy sessions: ${allSessions.length - brokenCount}`);

        if (brokenCount > 0) {
            console.log(`\n⚠️  Deleting ${brokenCount} broken DM sessions...`);

            const result = await DMSession.deleteMany({
                _id: { $in: brokenSessions }
            });

            console.log(`✅ Deleted ${result.deletedCount} broken sessions`);
        } else {
            console.log(`\n✅ No broken sessions found!`);
        }

        await mongoose.connection.close();
        console.log('\n✅ Cleanup complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

cleanupBrokenDMSessions();
