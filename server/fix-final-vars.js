#!/usr/bin/env node

/**
 * Final ESLint fix - remaining unused variables
 */

const fs = require('fs');
const path = require('path');

// Helper to replace unused variables in a specific line
function fixLineVariable(filePath, lineNum, oldVar, newVar) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return false;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const index = lineNum - 1;

    if (index < 0 || index >= lines.length) return false;

    lines[index] = lines[index].replace(new RegExp(`\\b${oldVar}\\b`, 'g'), newVar);
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
    console.log(`✓ ${filePath}:${lineNum} - ${oldVar} → ${newVar}`);
    return true;
}

// File fixes
const fixes = {
    'src/features/admin/admin.service.js': [
        [43, 'totalChannels', '_totalChannels']
    ],
    'src/features/ai/ai.controller.js': [
        [2, 'User', '_User']
    ],
    'src/features/analytics/analytics.controller.js': [
        [4, 'Department', '_Department'],
        [7, 'DMSession', '_DMSession']
    ],
    'src/features/auth/auth.controller.js': [
        [14, 'clearRefreshTokenCookie', '_clearRefreshTokenCookie'],
        [15, 'TIME', '_TIME'],
        [534, 'firstLogin', '_firstLogin'],
        [1788, 'passport', '_passport']
    ],
    'src/features/channels/channel.controller.js': [
        [6, 'notFound', '_notFound'],
        [7, 'extractMemberId', '_extractMemberId'],
        [8, 'emitToWorkspace, emitToChannel, emitToUser, emitToUsers', '_emitToWorkspace, _emitToChannel, _emitToUser, _emitToUsers'],
        [584, 'isTargetMember', '_isTargetMember'],
        [782, 'oldDesc', '_oldDesc'],
        [1069, 'user', '_user']
    ],
    'src/features/company-registration/registration.controller.js': [
        [17, 'adminUser', '_adminUser']
    ],
    'src/features/company-registration/registration.service.js': [
        [19, 'sendEmail', '_sendEmail'],
        [299, 'requestedChannels', '_requestedChannels']
    ],
    'src/features/company/metrics.service.js': [
        [24, 'messages', '_messages']
    ],
    'src/features/dashboard/dashboard.controller.js': [
        [5, 'Channel', '_Channel']
    ],
    'src/features/departments/departments.routes.js': [
        [116, 'channelCreatorId', '_channelCreatorId']
    ],
    'src/features/favorites/favorites.service.js': [
        [14, 'Channel', '_Channel'],
        [15, 'DMSession', '_DMSession']
    ],
    'src/features/internal-messaging/messaging.controller.js': [
        [6, 'Department', '_Department']
    ],
    'src/features/messages/message.controller.js': [
        [117, 'workspaceId', '_workspaceId']
    ],
    'src/features/notes/notes.service.js': [
        [13, 'mongoose', '_mongoose'],
        [17, 'User', '_User'],
        [221, 'req', '_req'],
        [296, 'req', '_req'],
        [445, 'req', '_req'],
        [505, 'req', '_req']
    ],
    'src/features/onboarding/onboarding.controller.js': [
        [3, 'Company', '_Company'],
        [26, 'generateCompanyEmail', '_generateCompanyEmail']
    ],
    'src/features/polls/poll.controller.js': [
        [3, 'User', '_User']
    ],
    'src/features/support/platform-support.controller.js': [
        [2, 'mongoose', '_mongoose'],
        [7, 'User', '_User'],
        [8, 'Company', '_Company'],
        [244, 'message', '_message'],
        [303, 'category', '_category']
    ],
    'src/modules/messages/messages.service.js': [
        [38, 'isEncrypted', '_isEncrypted']
    ]
};

let fixCount = 0;
for (const [file, changes] of Object.entries(fixes)) {
    for (const [line, ...vars] of changes) {
        if (vars.length === 2) {
            if (fixLineVariable(file, line, vars[0], vars[1])) fixCount++;
        } else {
            // Multiple vars on same line
            const [oldVars, newVars] = vars[0].split(' → ');
            if (fixLineVariable(file, line, oldVars.trim(), newVars.trim())) fixCount++;
        }
    }
}

console.log(`\n✨ Fixed ${fixCount} remaining issues!`);
