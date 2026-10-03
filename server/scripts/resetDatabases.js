#!/usr/bin/env node
'use strict';

/**
 * Wipe ALL application data and start fresh, keeping schemas:
 *   - MongoDB: drops the database named in MONGO_URI
 *   - PostgreSQL: truncates every table except schema_migrations
 *   - Redis: deletes presence, job locks, huddle state and the event stream
 *   - Object storage: deletes every object in S3_BUCKET (with --files)
 *
 *   node scripts/resetDatabases.js --yes [--files]
 *
 * Irreversible. Refuses to run with NODE_ENV=production.
 */

require('dotenv').config();

(async () => {
    if (!process.argv.includes('--yes')) {
        console.error('This deletes all data. Re-run with --yes to confirm.');
        process.exit(1);
    }
    if (process.env.NODE_ENV === 'production') {
        console.error('Refusing to reset a production environment.');
        process.exit(1);
    }

    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    const dbName = mongoose.connection.db.databaseName;
    await mongoose.connection.db.dropDatabase();
    console.log(`MongoDB: dropped database "${dbName}"`);
    await mongoose.disconnect();

    const { query, closePostgres } = require('../src/shared/postgres');
    const { rows } = await query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`);
    if (rows.length) {
        await query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
    console.log(`PostgreSQL: truncated ${rows.length} table(s)`);
    await closePostgres();

    if (process.env.REDIS_URL) {
        const { default: Redis } = require('ioredis');
        const r = new Redis(process.env.REDIS_URL);
        let removed = 0;
        for (const pattern of ['presence:*', 'job:*', 'huddles:*', 'oruinwan:events', 'socket.io*']) {
            const keys = await r.keys(pattern);
            if (keys.length) removed += await r.del(...keys);
        }
        console.log(`Redis: removed ${removed} key(s)`);
        r.disconnect();
    }

    if (process.argv.includes('--files') && process.env.S3_BUCKET) {
        const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
        const s3 = new S3Client({
            region: process.env.S3_REGION || 'us-east-1',
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
            credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
        });
        let token; let removed = 0;
        do {
            const page = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, ContinuationToken: token }));
            const objects = (page.Contents || []).map((o) => ({ Key: o.Key }));
            if (objects.length) {
                await s3.send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET, Delete: { Objects: objects } }));
                removed += objects.length;
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        console.log(`Object storage: deleted ${removed} object(s) from ${process.env.S3_BUCKET}`);
    }
    console.log('Reset complete. Create the platform admin with: node scripts/createChttrixAdmin.js');
})().catch((err) => { console.error(err.message); process.exit(1); });
