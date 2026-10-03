#!/usr/bin/env node
'use strict';

/**
 * Stage 3 pre-flight: which models carry a tenant field, and whether it is
 * indexed. Needs no database; it inspects the Mongoose schemas.
 *
 *   node scripts/shardReadiness.js
 *
 * "tenant field" = company | companyId | workspace | workspaceId. A model
 * without one is either platform-wide (users, companies, billing) or needs
 * one added before it can be sharded or moved to a tenant database.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const TENANT_FIELDS = ['company', 'companyId', 'workspace', 'workspaceId'];
const PLATFORM_WIDE = new Set(['User', 'Company', 'Billing', 'Invoice', 'PlatformSession', 'ScimToken', 'SupportTicket', 'SupportMessage', 'UserIdentityKey', 'UserSession', 'UserCryptoState', 'UserDeviceSession', 'Invite', 'Workspace', 'Department', 'Team', 'Permission', 'WorkspaceTemplate', 'WorkspacePermission']);

function loadModels() {
    for (const dir of [path.join(__dirname, '..', 'models'), path.join(__dirname, '..', 'src', 'models')]) {
        for (const f of fs.readdirSync(dir)) if (f.endsWith('.js') && f !== 'encryption.js') { try { require(path.join(dir, f)); } catch { /* skip */ } }
    }
    for (const rel of ['../src/modules/messages/message.model', '../src/modules/messages/messageReminder.model', '../src/modules/notifications/notification.model', '../src/modules/huddles/huddleSession.model', '../src/features/channels/channel.model', '../src/features/files/WorkspaceFile', '../src/features/files/FileVersion', '../src/features/files/FileComment']) {
        try { require(path.join(__dirname, rel)); } catch { /* optional */ }
    }
}

function report() {
    loadModels();
    const rows = [];
    for (const name of mongoose.modelNames().sort()) {
        const schema = mongoose.model(name).schema;
        const fields = TENANT_FIELDS.filter((f) => schema.path(f));
        const indexed = fields.filter((f) => schema.indexes().some(([keys]) => Object.keys(keys)[0] === f));
        let status;
        if (fields.length === 0) status = PLATFORM_WIDE.has(name) ? 'platform-wide' : 'NO TENANT FIELD';
        else if (indexed.length === 0) status = 'tenant field NOT indexed first';
        else status = 'ready';
        rows.push({ model: name, collection: mongoose.model(name).collection.collectionName, tenantFields: fields.join(',') || '-', status });
    }
    return rows;
}

if (require.main === module) {
    const rows = report();
    console.table(rows);
    const problems = rows.filter((r) => r.status !== 'ready' && r.status !== 'platform-wide');
    console.log(problems.length ? `${problems.length} model(s) need attention before sharding.` : 'All tenant models are shard-ready.');
}

module.exports = { report, TENANT_FIELDS };
