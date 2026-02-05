#!/usr/bin/env node

/**
 * Script to fix all model imports with incorrect underscore prefixes
 * Replaces /_ModelName with /ModelName in all require statements
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/socket/handlers/messages.socket.js',
        replacements: [
            { from: "require('../../../models/_DMSession')", to: "require('../../../models/DMSession')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/analytics/analytics.controller.js',
        replacements: [
            { from: "require('../../../models/_Department')", to: "require('../../../models/Department')" },
            { from: "require('../../../models/_DMSession')", to: "require('../../../models/DMSession')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/internal-messaging/messaging.controller.js',
        replacements: [
            { from: "require('../../../models/_Department')", to: "require('../../../models/Department')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/support/platform-support.controller.js',
        replacements: [
            { from: "require('../../../models/_User')", to: "require('../../../models/User')" },
            { from: "require('../../../models/_Company')", to: "require('../../../models/Company')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/ai/ai.controller.js',
        replacements: [
            { from: 'require("../../../models/_User")', to: 'require("../../../models/User")' }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/workspaces/workspace-admin.controller.js',
        replacements: [
            { from: 'require("../../../models/_User")', to: 'require("../../../models/User")' }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/notes/notes.service.js',
        replacements: [
            { from: "require('../../../models/_User')", to: "require('../../../models/User')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/polls/poll.controller.js',
        replacements: [
            { from: 'require("../../../models/_User")', to: 'require("../../../models/User")' }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/favorites/favorites.service.js',
        replacements: [
            { from: "require('../../../models/_DMSession')", to: "require('../../../models/DMSession')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/tasks/tasks.policy.js',
        replacements: [
            { from: "require('../../../models/_Workspace')", to: "require('../../../models/Workspace')" }
        ]
    },
    {
        file: '/Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/server/src/features/tasks/tasks.service.js',
        replacements: [
            { from: "require('../../../models/_DMSession')", to: "require('../../../models/DMSession')" }
        ]
    }
];

let totalFixed = 0;

filesToFix.forEach(({ file, replacements }) => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;

        replacements.forEach(({ from, to }) => {
            if (content.includes(from)) {
                content = content.replace(from, to);
                modified = true;
                totalFixed++;
                console.log(`✅ Fixed in ${path.basename(file)}: ${from} → ${to}`);
            }
        });

        if (modified) {
            fs.writeFileSync(file, content, 'utf8');
        }
    } catch (err) {
        console.error(`❌ Error processing ${file}:`, err.message);
    }
});

console.log(`\n🎉 Fixed ${totalFixed} model import(s)`);
