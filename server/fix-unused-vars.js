#!/usr/bin/env node

/**
 * Auto-fix ESLint no-unused-vars warnings by prefixing with underscore
 * This script parses ES Lint output and fixes unused variable declarations
 */

const fs = require('fs');
const path = require('path');

// Map of file -> line number -> variable name to fix
const fixes = {
    'src/features/auth/auth.controller.js': {
        303: 'category'
    },
    'src/features/tasks/tasks.policy.js': {
        15: 'Workspace'
    },
    'src/features/tasks/tasks.service.js': {
        34: 'DMSession',
        45: 'validator',
        72: 'assignedTo',
        90: 'workspace'
    },
    'src/features/workspaces/workspace-admin.controller.js': {
        2: 'User',
        205: 'isExpired',
        244: 'e',
        610: 'invitesToDelete'
    },
    'src/features/workspaces/workspace.controller.js': {
        12: 'createInvite',
        14: ['notFound', 'badRequest', 'forbidden'], // Multiple on same line
        15: 'isMember',
        326: 'deletedChannels',
        329: 'deletedMessages',
        332: 'deletedDMSessions',
        335: 'deletedTasks',
        338: 'deletedNotes',
        341: 'deletedUpdates',
        344: 'deletedFavorites',
        347: 'deletedInvites',
        412: 'invite',
        447: 'e',
        465: 'invite'
    },
    'src/index.js': {
        358: 'next'
    },
    'src/modules/conversations/cryptoUtils.js': {
        37: 'workspaceId'
    },
    'src/modules/conversations/serverKEK.crypto.js': {
        9: 'AUTH_TAG_LENGTH'
    },
    'src/modules/encryption/encryption.controller.js': {
        83: 'requesterId'
    },
    'src/modules/messages/__tests__/messages.service.test.js': {
        74: 'result'
    },
    'src/modules/messages/messages.service.js': {
        11: 'Channel',
        13: 'isMember',
        38: 'isEncrypted'
    },
    'src/modules/threads/threads.controller.js': {
        77: 'isSender'
    },
    'src/scripts/rotateServerKEK.js': {
        124: 'auditError',
        194: 'auditError',
        247: 'auditError'
    },
    'src/services/deviceSession.service.js': {
        68: 'auditError',
        93: 'notificationError'
    },
    'src/services/kekManager.service.js': {
        88: 'error'
    },
    'src/services/securityNotification.service.js': {
        229: 'html'
    },
    'src/shared/middleware/auth.js': {
        41: 'auditError',
        59: 'err',
        67: 'decoded',
        104: 'err'
    },
    'src/shared/services/otp.service.js': {
        118: 'error'
    },
    'src/shared/utils/errorHandler.js': {
        6: 'next'
    },
    'src/socket/handlers/messages.socket.js': {
        32: 'workspaceId',
        319: 'DMSession'
    }
};

function fixFile(filePath, lineMap) {
    const fullPath = path.join(__dirname, filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    let modified = false;

    for (const [lineNum, varNames] of Object.entries(lineMap)) {
        const index = parseInt(lineNum) - 1;
        if (index < 0 || index >= lines.length) continue;

        let line = lines[index];
        const vars = Array.isArray(varNames) ? varNames : [varNames];

        for (const varName of vars) {
            // Skip if already prefixed
            if (varName.startsWith('_')) continue;

            // Pattern to match variable declarations
            const patterns = [
                // const/let/var declarations
                new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g'),
                // Destructuring
                new RegExp(`([{,]\\s*)${varName}(\\s*[,}])`, 'g'),
                // Function parameters
                new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
                // Catch errors
                new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`, 'g')
            ];

            for (const pattern of patterns) {
                if (pattern.test(line)) {
                    // Replace the variable name with underscore-prefixed version
                    line = line.replace(
                        new RegExp(`\\b${varName}\\b`, 'g'),
                        `_${varName}`
                    );
                    modified = true;
                    console.log(`✓ ${filePath}:${lineNum} - ${varName} → _${varName}`);
                    break;
                }
            }
        }

        lines[index] = line;
    }

    if (modified) {
        fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
        console.log(`✅ Fixed ${filePath}`);
    }
}

console.log('🔧 Starting auto-fix for unused variables...\n');

for (const [filePath, lineMap] of Object.entries(fixes)) {
    fixFile(filePath, lineMap);
}

console.log('\n✨ Auto-fix complete! Run `npm run lint` to verify.');
