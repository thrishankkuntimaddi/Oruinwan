#!/usr/bin/env node
/**
 * Repair Conversation Keys Script
 * 
 * Triggers the backend auto-repair endpoint to fix conversation key distribution issues.
 * Run this after creating channels if you get "403 KEY_NOT_DISTRIBUTED" errors.
 * 
 * Usage:
 *   node scripts/repair-conversation-keys.js
 */

const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://chttrix-api-dcj2qvm4xa-uc.a.run.app';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || process.argv[2];

if (!ACCESS_TOKEN) {
    console.error('❌ Error: ACCESS_TOKEN not provided');
    console.error('');
    console.error('Usage:');
    console.error('  1. Get your access token from browser:');
    console.error('     - Open DevTools → Application → Local Storage');
    console.error('     - Copy the value of "accessToken"');
    console.error('');
    console.error('  2. Run this script:');
    console.error('     ACCESS_TOKEN=your_token node scripts/repair-conversation-keys.js');
    console.error('     OR');
    console.error('     node scripts/repair-conversation-keys.js your_token');
    process.exit(1);
}

console.log('🔧 Starting conversation key repair...');
console.log(`📡 Backend: ${BACKEND_URL}`);
console.log('');

const url = new URL('/api/v2/conversations/repair-access', BACKEND_URL);

const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log('');

        try {
            const result = JSON.parse(data);

            if (res.statusCode === 200) {
                console.log('✅ Repair completed successfully!');
                console.log('');
                console.log('Results:');
                console.log(`  - Channels processed: ${result.channelsProcessed || 0}`);
                console.log(`  - Keys distributed: ${result.keysDistributed || 0}`);
                console.log(`  - Errors: ${result.errors?.length || 0}`);

                if (result.details) {
                    console.log('');
                    console.log('Details:', JSON.stringify(result.details, null, 2));
                }

                console.log('');
                console.log('✅ You should now be able to send messages!');
            } else {
                console.error('❌ Repair failed');
                console.error('Response:', JSON.stringify(result, null, 2));
            }
        } catch (err) {
            console.error('❌ Failed to parse response');
            console.error('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
});

req.end();
