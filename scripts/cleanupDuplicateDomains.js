// server/scripts/cleanupDuplicateDomains.js
// Clean up companies with duplicate null domains

require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected\n");

        // Find all companies with null domain
        const companiesWithNullDomain = await Company.find({
            $or: [{ domain: null }, { domain: "" }]
        });

        console.log(`📋 Found ${companiesWithNullDomain.length} companies with null/empty domain:\n`);

        companiesWithNullDomain.forEach((company, index) => {
            console.log(`${index + 1}. ${company.name} (ID: ${company._id})`);
            console.log(`   Created: ${company.createdAt}`);
            console.log(`   Domain: ${company.domain === null ? 'null' : `"${company.domain}"`}\n`);
        });

        if (companiesWithNullDomain.length > 1) {
            console.log("⚠️  Multiple companies with null domain detected!");
            console.log("This should work fine now with the sparse index.\n");
        }

        // Show all companies
        const allCompanies = await Company.find({}).select('name domain createdAt');
        console.log(`\n📊 All companies in database (${allCompanies.length} total):`);
        allCompanies.forEach((company, index) => {
            console.log(`${index + 1}. ${company.name}`);
            console.log(`   Domain: ${company.domain || '(none)'}`);
            console.log(`   Created: ${company.createdAt}\n`);
        });

    } catch (err) {
        console.error("\n❌ ERROR:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB\n");
        process.exit(0);
    }
}

cleanup();
