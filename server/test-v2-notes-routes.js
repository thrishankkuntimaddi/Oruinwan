#!/usr/bin/env node
/**
 * Quick smoke test for v2 Notes API
 * Tests route registration and authentication
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';
const ENDPOINTS = [
    { method: 'GET', path: '/api/v2/notes', name: 'List notes' },
    { method: 'POST', path: '/api/v2/notes', name: 'Create note' },
    { method: 'PUT', path: '/api/v2/notes/test-id', name: 'Update note' },
    { method: 'DELETE', path: '/api/v2/notes/test-id', name: 'Delete note' },
    { method: 'POST', path: '/api/v2/notes/test-id/share', name: 'Share note' },
    { method: 'POST', path: '/api/v2/notes/test-id/attachments', name: 'Add attachment' },
    { method: 'DELETE', path: '/api/v2/notes/test-id/attachments/att-id', name: 'Remove attachment' },
    { method: 'GET', path: '/api/v2/notes/test-id/attachments/att-id/download', name: 'Download attachment' },
];

console.log('🧪 Testing v2 Notes API Routes\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

async function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: endpoint.path,
            method: endpoint.method,
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const status = res.statusCode;
                const isRegistered = status === 401 || status === 403;

                if (isRegistered) {
                    console.log(`✅ ${endpoint.method.padEnd(6)} ${endpoint.path}`);
                    console.log(`   Status: ${status} (route registered, auth working)`);
                    passed++;
                } else if (status === 404) {
                    console.log(`❌ ${endpoint.method.padEnd(6)} ${endpoint.path}`);
                    console.log(`   Status: 404 - ROUTE NOT FOUND`);
                    failed++;
                } else {
                    console.log(`⚠️  ${endpoint.method.padEnd(6)} ${endpoint.path}`);
                    console.log(`   Status: ${status} - Unexpected response`);
                    failed++;
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            console.log(`❌ ${endpoint.method.padEnd(6)} ${endpoint.path}`);
            console.log(`   Error: ${err.message}`);
            failed++;
            resolve();
        });

        req.end();
    });
}

async function runTests() {
    for (const endpoint of ENDPOINTS) {
        await testEndpoint(endpoint);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

    if (failed === 0) {
        console.log('✅ All v2 Notes routes are registered and responding!');
        console.log('🔐 Authentication middleware is active (401 responses)');
        console.log('\n💡 Next: Test with real auth token or verify file operations');
        process.exit(0);
    } else {
        console.log('❌ Some routes failed - check server.js registration');
        process.exit(1);
    }
}

runTests();
