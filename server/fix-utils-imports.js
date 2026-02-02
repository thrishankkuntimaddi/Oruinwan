#!/usr/bin/env node
// Comprehensive fix: Update ALL legacy model imports

const fs = require('fs');
const path = require('path');

// Files to fix and their mappings
const fixes = [
    // utils/aiActions.js
    {
        file: 'utils/aiActions.js',
        replacements: [
            { from: "require('../models/Channel')", to: "require('./src/features/channels/channel.model')" },
            { from: "require('../models/Message')", to: "require('./src/features/messages/message.model')" },
        ]
    },
    // utils/analyticsService.js
    {
        file: 'utils/analyticsService.js',
        replacements: [
            { from: "require(\"../models/Channel\")", to: "require('../src/features/channels/channel.model')" },
            { from: "require(\"../models/Message\")", to: "require('../src/features/messages/message.model')" },
        ]
    },
    // server.js
    {
        file: 'server.js',
        replacements: [
            { from: 'require("./models/User")', to: 'require("./models/User")' }, // Keep as-is, User not migrated yet
        ]
    },
];

console.log('🔧 Fixing legacy model imports in utils/ and root files...\n');

fixes.forEach(({ file, replacements }) => {
    const filePath = path.join(__dirname, file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipped: ${file} (not found)`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    replacements.forEach(({ from, to }) => {
        if (content.includes(from)) {
            content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Fixed: ${file}`);
    } else {
        console.log(`⏭️  No changes: ${file}`);
    }
});

console.log('\n✅ Done!\n');
