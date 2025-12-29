// server/scripts/remove-console-logs.js
/**
 * Script to remove all console.log, console.info, console.debug statements from server code
 * Keeps console.error and console.warn only
 */

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');

const removeConsoleLogs = (filePath) => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Remove console.log statements (multiline aware)
        const beforeLines = content.split('\n').length;

        // Remove patterns like:
        // console.log(...);
        // console.info(...);
        // console.debug(...);
        content = content.replace(/^\s*console\.(log|info|debug)\([^;]*\);?\s*$/gm, '');

        // Remove standalone console statements without semicolon
        content = content.replace(/^\s*console\.(log|info|debug)\([^)]*\)\s*$/gm, '');

        const afterLines = content.split('\n').length;

        if (beforeLines !== afterLines) {
            modified = true;
            // Remove excessive blank lines (max 2 consecutive)
            content = content.replace(/\n\n\n+/g, '\n\n');

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${path.basename(filePath)}: Removed ${beforeLines - afterLines} lines`);
        }

        return modified;
    } catch (err) {
        console.error(`❌ Error processing ${filePath}:`, err.message);
        return false;
    }
};

const processDirectory = (dirPath, extensions = ['.js']) => {
    const files = fs.readdirSync(dirPath);
    let totalModified = 0;

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && file !== 'node_modules' && file !== 'utils') {
            // Recursively process subdirectories (skip node_modules and utils)
            totalModified += processDirectory(filePath, extensions);
        } else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
            if (removeConsoleLogs(filePath)) {
                totalModified++;
            }
        }
    });

    return totalModified;
};

// Run the script on controllers
const controllersDir = path.join(__dirname, '../controllers');
console.log('🧹 Cleaning console.log statements from controllers...\n');
const modified = processDirectory(controllersDir);
console.log(`\n📊 Total files modified: ${modified}`);
