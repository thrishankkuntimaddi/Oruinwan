#!/usr/bin/env node
'use strict';

/**
 * Build every index declared in the Mongoose schemas, once, from a deploy step
 * instead of from each booting server (set MONGO_AUTO_INDEX=false in production).
 *
 *   node scripts/syncIndexes.js            create missing indexes, keep extras
 *   node scripts/syncIndexes.js --prune    also drop indexes no schema declares
 *                                          (never touches retention_ttl, see src/shared/retentionIndexes.js)
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const prune = process.argv.includes('--prune');

function loadAllModels() {
    const dirs = [path.join(__dirname, '..', 'models'), path.join(__dirname, '..', 'src', 'models')];
    for (const dir of dirs) {
        for (const file of fs.readdirSync(dir)) {
            if (file.endsWith('.js') && file !== 'encryption.js') require(path.join(dir, file));
        }
    }
    // Models that live inside their module/feature folders.
    const extra = [
        '../src/modules/messages/message.model',
        '../src/modules/messages/messageReminder.model',
        '../src/modules/notifications/notification.model',
        '../src/modules/huddles/huddleSession.model',
        '../src/features/channels/channel.model',
        '../src/features/files/WorkspaceFile',
        '../src/features/files/FileVersion',
        '../src/features/files/FileComment',
    ];
    for (const rel of extra) {
        try { require(path.join(__dirname, rel)); } catch (err) { console.warn(`skip ${rel}: ${err.message}`); }
    }
}

(async () => {
    if (!process.env.MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    loadAllModels();

    for (const name of mongoose.modelNames()) {
        const Model = mongoose.model(name);
        try {
            if (prune) {
                const dropped = await Model.syncIndexes({ background: true, filter: (ix) => ix.name !== 'retention_ttl' });
                console.log(`${name}: synced${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`);
            } else {
                await Model.createIndexes({ background: true });
                console.log(`${name}: ok`);
            }
        } catch (err) {
            console.error(`${name}: ${err.message}`);
        }
    }
    await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
