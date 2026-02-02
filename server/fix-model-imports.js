#!/usr/bin/env node
// Fix all legacy model imports to use /src/features models

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Map of legacy model names to new paths (relative from src root)
const MODEL_MAPPINGS = {
    'Message': './features/messages/message.model.js',
    'Channel': './features/channels/channel.model.js',
    'Poll': './features/polls/poll.model.js',
};

console.log('🔍 Finding all files with legacy model imports...\n');

// Find all .js files in src directory that import from ../models or ../../models or ../../../models
const findCommand = `find src -type f -name "*.js" | xargs grep -l "require.*models/"`;

let files;
try {
    files = execSync(findCommand, { encoding: 'utf-8', cwd: __dirname })
        .trim()
        .split('\n')
        .filter(Boolean);
} catch (err) {
    console.log('✅ No legacy imports found!');
    process.exit(0);
}

console.log(`Found ${files.length} files with legacy imports\n`);

let totalReplacements = 0;

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const originalContent = content;

    // Replace each model type
    Object.entries(MODEL_MAPPINGS).forEach(([modelName, newPath]) => {
        // Match patterns like: require("../../../models/Message")
        const patterns = [
            new RegExp(`require\\(["'](\\.\\.\\/)+(models\\/${modelName})["']\\)`, 'g'),
            new RegExp(`require\\(["']\\.\\.\\/(models\\/${modelName})["']\\)`, 'g'),
        ];

        patterns.forEach(pattern => {
            if (pattern.test(content)) {
                // Calculate relative path from current file to new model location
                const fileDir = path.dirname(filePath);
                const absoluteNewPath = path.join('src', newPath);
                let relativePath = path.relative(fileDir, absoluteNewPath);

                // Ensure path starts with ./
                if (!relativePath.startsWith('.')) {
                    relativePath = './' + relativePath;
                }

                // Replace with new path
                content = content.replace(pattern, `require("${relativePath}")`);
                modified = true;
            }
        });
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Fixed: ${filePath}`);
        totalReplacements++;
    }
});

console.log(`\n✨ Updated ${totalReplacements} files`);
console.log('\n📝 Note: Some models may still need manual fixing if they don\'t exist in /src/features yet\n');
