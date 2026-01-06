// server/scripts/recreateDomainIndex.js
// Force recreate the domain index to ensure it's properly sparse

require("dotenv").config();
const mongoose = require("mongoose");

async function recreateIndex() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected\n");

        const db = mongoose.connection.db;
        const collection = db.collection("companies");

        console.log("🔧 Dropping domain_1 index if it exists...");
        try {
            await collection.dropIndex("domain_1");
            console.log("✅ Index dropped\n");
        } catch (err) {
            if (err.code === 27 || err.codeName === 'IndexNotFound') {
                console.log("ℹ️  Index doesn't exist (this is OK)\n");
            } else {
                throw err;
            }
        }

        console.log("🔧 Creating new sparse unique index on domain...");
        await collection.createIndex(
            { domain: 1 },
            {
                unique: true,
                sparse: true,
                name: "domain_1"
            }
        );
        console.log("✅ Sparse index created successfully\n");

        // Verify
        const indexes = await collection.indexes();
        const domainIndex = indexes.find(idx => idx.name === "domain_1");

        console.log("✅ Verification:");
        console.log(`  - Index name: ${domainIndex.name}`);
        console.log(`  - Unique: ${domainIndex.unique}`);
        console.log(`  - Sparse: ${domainIndex.sparse}`);
        console.log(`  - Key: ${JSON.stringify(domainIndex.key)}`);

        console.log("\n" + "=".repeat(80));
        console.log("✅ DOMAIN INDEX RECREATED SUCCESSFULLY!");
        console.log("=".repeat(80));
        console.log("Companies can now register without domains (domain: null)");
        console.log("=".repeat(80) + "\n");

    } catch (err) {
        console.error("\n❌ ERROR:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB\n");
        process.exit(0);
    }
}

recreateIndex();
