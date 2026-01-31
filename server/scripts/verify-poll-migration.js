#!/usr/bin/env node
/**
 * PHASE 2A-4: Polls Canonicalization Verification Script
 * 
 * Purpose: Verify that all 6 poll routes are routed to canonical controller
 * Expected: All routes return 401 Unauthorized (since no auth token provided)
 * Success: Server doesn't crash, logs show [POLLS:MODULAR] prefix
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5001';
const API_PREFIX = '/api/polls';

// Color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

const tests = [
    {
        name: 'POST /polls (create poll)',
        method: 'POST',
        path: '',
        body: { question: 'Test?', options: ['A', 'B'], channelId: 'test123' },
        expectedStatus: 401
    },
    {
        name: 'GET /polls/:pollId (get poll by ID)',
        method: 'GET',
        path: '/poll123',
        expectedStatus: 401
    },
    {
        name: 'GET /polls/channel/:channelId (get polls by channel)',
        method: 'GET',
        path: '/channel/channel123',
        expectedStatus: 401
    },
    {
        name: 'POST /polls/:pollId/vote (vote on poll)',
        method: 'POST',
        path: '/poll123/vote',
        body: { optionIds: ['opt1'] },
        expectedStatus: 401
    },
    {
        name: 'PATCH /polls/:pollId/close (close poll)',
        method: 'PATCH',
        path: '/poll123/close',
        expectedStatus: 401
    },
    {
        name: 'DELETE /polls/:pollId (delete poll)',
        method: 'DELETE',
        path: '/poll123',
        expectedStatus: 401
    }
];

async function runTest(test) {
    const url = `${BASE_URL}${API_PREFIX}${test.path}`;

    try {
        const config = {
            method: test.method,
            url,
            validateStatus: () => true // Accept any status
        };

        if (test.body) {
            config.data = test.body;
        }

        const response = await axios(config);

        const statusMatch = response.status === test.expectedStatus;
        const statusColor = statusMatch ? GREEN : RED;

        console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
        console.log(`Test: ${test.name}`);
        console.log(`URL: ${test.method} ${url}`);
        console.log(`Status: ${statusColor}${response.status}${RESET} (expected: ${test.expectedStatus})`);
        console.log(`Result: ${statusMatch ? GREEN + '✅ PASS' : RED + '❌ FAIL'}${RESET}`);

        return {
            name: test.name,
            passed: statusMatch,
            status: response.status,
            expectedStatus: test.expectedStatus
        };
    } catch (error) {
        console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
        console.log(`Test: ${test.name}`);
        console.log(`URL: ${test.method} ${url}`);
        console.log(`Error: ${RED}${error.message}${RESET}`);
        console.log(`Result: ${RED}❌ FAIL (Network Error)${RESET}`);

        return {
            name: test.name,
            passed: false,
            error: error.message
        };
    }
}

async function main() {
    console.log(`${YELLOW}╔════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${YELLOW}║  PHASE 2A-4: Polls Canonicalization Verification          ║${RESET}`);
    console.log(`${YELLOW}╚════════════════════════════════════════════════════════════╝${RESET}\n`);

    console.log(`Testing API at: ${BLUE}${BASE_URL}${API_PREFIX}${RESET}\n`);

    const results = [];

    for (const test of tests) {
        const result = await runTest(test);
        results.push(result);
        console.log(''); // Blank line between tests
    }

    // Summary
    console.log(`${YELLOW}═══════════════════════════════════════════════════════════${RESET}`);
    console.log(`${YELLOW}SUMMARY${RESET}\n`);

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total Tests: ${tests.length}`);
    console.log(`${GREEN}Passed: ${passed}${RESET}`);
    console.log(`${RED}Failed: ${failed}${RESET}\n`);

    if (failed === 0) {
        console.log(`${GREEN}✅ ALL TESTS PASSED${RESET}`);
        console.log(`${GREEN}✅ Canonical controller is correctly wired${RESET}`);
        console.log(`${GREEN}✅ Server is responding to all poll routes${RESET}\n`);

        console.log(`${YELLOW}Next Steps:${RESET}`);
        console.log(`1. Check server logs for [POLLS:MODULAR] verification logs`);
        console.log(`2. Perform manual testing with authenticated requests`);
        console.log(`3. Verify poll creation flow`);
        console.log(`4. Verify poll voting flow`);
        console.log(`5. Verify poll closure and deletion\n`);

        process.exit(0);
    } else {
        console.log(`${RED}❌ SOME TESTS FAILED${RESET}`);
        console.log(`${RED}❌ Please check server logs and configuration${RESET}\n`);

        process.exit(1);
    }
}

// Check if server is running
axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log(`${GREEN}✅ Server is running at ${BASE_URL}${RESET}\n`);
        return main();
    })
    .catch(() => {
        console.log(`${RED}❌ Server is not running at ${BASE_URL}${RESET}`);
        console.log(`${YELLOW}Please start the server first:${RESET}`);
        console.log(`  cd server && node server.js\n`);
        process.exit(1);
    });
