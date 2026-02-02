#!/usr/bin/env node
// Final comprehensive sweep: Replace ALL remaining legacy model imports

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Finding ALL files with legacy model imports...\n');

// Get all .js files excluding node_modules, .git, and models directory
const findCommand = `find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./models/*" -not -path "./fix-*.js"`;

let files;
try {
    files = execSync(findCommand, { encoding: 'utf-8', cwd: __dirname })
        .trim()
        .split('\n')
        .filter(Boolean);
} catch (err) {
    console.log('No files found');
    process.exit(0);
}

// Filter to only files that actually have legacy imports
const filesWithLegacyImports = files.filter(file => {
    try {
        const content = fs.readFileSync(file, 'utf-8');
        return /require\(['"]\.*\/models\//.test(content);
    } catch {
        return false;
    }
});

console.log(`Found ${filesWithLegacyImports.length} files with legacy imports\n`);

// Define replacement rules for models that exist in /src/features
const MODEL_REPLACEMENTS = {
    'Message': 'messages/message.model.js',
    'Channel': 'channels/channel.model.js',
    'Poll': 'polls/poll.model.js',
};

let totalFixed = 0;

filesWithLegacyImports.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const originalContent = content;

    // Replace each migrated model
    Object.entries(MODEL_REPLACEMENTS).forEach(([modelName, newPath]) => {
        // Calculate the correct relative path from this file to the new model
        const fileDir = path.dirname(filePath);
        const absoluteNewPath = path.join(__dirname, 'src', 'features', newPath);
        let relativePath = path.relative(fileDir, absoluteNewPath);

        // Ensure path starts with ./
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }

        // Match various import patterns
        const patterns = [
            new RegExp(`require\\(["']\\.\\./models/${modelName}["']\\)`, 'g'),
            new RegExp(`require\\(["']\\.\\.\\.\\/models/${modelName}["']\\)`, 'g'),
            new RegExp(`require\\(["']\\.\\.\\.\\/\\.\\.\\/models/${modelName}["']\\)`, 'g'),
            new RegExp(`require\\(["']\\.\\.\\.\\/\\.\\.\\/\\.\\.\\/models/${modelName}["']\\)`, 'g'),
            new RegExp(`require\\(["']\\./models/${modelName}["']\\)`, 'g'),
        ];

        patterns.forEach(pattern => {
            if (pattern.test(content)) {
                content = content.replace(pattern, `require("${relativePath}")`);
                modified = true;
            }
        });
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Fixed: ${filePath}`);
        totalFixed++;
    }
});

console.log(`\n✨ Updated ${totalFixed} files`);
console.log('\n📋 Summary:');
console.log(`   - Message, Channel, Poll → migrated to /src/features`);
console.log(`   - Other models (User, Workspace, etc.) → kept in /models for now`);
console.log('\nRun the server to verify all imports work correctly.\n');
