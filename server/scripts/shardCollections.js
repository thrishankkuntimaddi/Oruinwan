#!/usr/bin/env node
'use strict';

/**
 * Stage 3: spread the hot collections over a sharded MongoDB cluster, keyed by
 * tenant so one company's data stays together.
 *
 *   node scripts/shardCollections.js --plan     print what would be done (no cluster needed)
 *   node scripts/shardCollections.js            enable sharding and shard each collection
 *
 * Run against a mongos of an Atlas sharded cluster (or `sh.enableSharding`
 * rights). Collections are sharded on { <tenant field>: 1, _id: 1 }: range
 * sharding on the tenant keeps a company on few chunks for cheap scoped
 * queries, and _id breaks ties so a very large tenant can still be split.
 * Every listed query path already filters by the tenant field, so routing
 * stays targeted (see scripts/shardReadiness.js).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const PLAN = [
    { collection: 'messages', key: { company: 1, _id: 1 } },
    { collection: 'tasks', key: { company: 1, _id: 1 } },
    { collection: 'notes', key: { workspace: 1, _id: 1 } },
    { collection: 'notifications', key: { workspaceId: 1, _id: 1 } },
    { collection: 'auditlogs', key: { companyId: 1, _id: 1 } },
    { collection: 'historylogs', key: { company: 1, _id: 1 } },
    { collection: 'activityevents', key: { workspaceId: 1, _id: 1 } },
    { collection: 'workspacefiles', key: { workspaceId: 1, _id: 1 } },
    { collection: 'huddlesessions', key: { workspaceId: 1, _id: 1 } },
];

function describe(dbName) {
    console.log(`Database: ${dbName}`);
    for (const p of PLAN) console.log(`  sh.shardCollection("${dbName}.${p.collection}", ${JSON.stringify(p.key)})`);
}

(async () => {
    const plan = process.argv.includes('--plan');
    if (!process.env.MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    const admin = db.admin();

    if (plan) { describe(dbName); await mongoose.disconnect(); return; }

    const hello = await admin.command({ hello: 1 });
    if (hello.msg !== 'isdbgrid') {
        console.error('Not connected to a mongos router. Point MONGO_URI at a sharded cluster, or use --plan to preview.');
        process.exit(2);
    }

    try {
        await admin.command({ enableSharding: dbName });
        console.log(`Sharding enabled on ${dbName}`);
    } catch (err) {
        if (!/already enabled/i.test(err.message)) throw err;
    }

    for (const p of PLAN) {
        const ns = `${dbName}.${p.collection}`;
        try {
            // The shard key needs a supporting index; create it first (no-op if present).
            await db.collection(p.collection).createIndex(p.key, { background: true });
            await admin.command({ shardCollection: ns, key: p.key });
            console.log(`sharded ${ns} on ${JSON.stringify(p.key)}`);
        } catch (err) {
            if (/already sharded/i.test(err.message)) console.log(`${ns}: already sharded`);
            else console.error(`${ns}: ${err.message}`);
        }
    }
    await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });

module.exports = { PLAN };
