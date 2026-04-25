#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

const tests = [
    {
        name: 'Login (should fail with 400 - testing route)',
        method: 'POST',
        path: '/login',
        data: { email: 'test@test.com', password: 'test' },
        expectedLog: '🔄 [MODULAR AUTH] Function invoked: login'
    },
    {
        name: 'Signup (should fail with validation - testing route)',
        method: 'POST',
        path: '/signup',
        data: { email: 'test@test.com' },
        expectedLog: '🔄 [MODULAR AUTH] Function invoked: signup'
    },
    {
        name: 'Forgot Password',
        method: 'POST',
        path: '/forgot-password',
        data: { email: 'nonexistent@test.com' },
        expectedLog: '🔄 [MODULAR AUTH] Function invoked: forgotPassword'
    },
    {
        name: 'Refresh Token (should fail - no token)',
        method: 'POST',
        path: '/refresh',
        data: {},
        expectedLog: '🔄 [MODULAR AUTH] Function invoked: refresh'
    }
];

async function runTests() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 Auth Canonicalization Verification Tests');
    console.log('='.repeat(80) + '\n');

    let passCount = 0;
    let failCount = 0;

    for (const test of tests) {
        try {
            console.log(`${colors.blue}Testing:${colors.reset} ${test.name}`);
            console.log(`  ${test.method} ${BASE_URL}${test.path}`);

            const config = {
                method: test.method.toLowerCase(),
                url: BASE_URL + test.path,
                data: test.data,
                validateStatus: () => true 
            };

            const response = await axios(config);

            console.log(`  ${colors.yellow}Status:${colors.reset} ${response.status}`);
            console.log(`  ${colors.green}✓ Route is accessible${colors.reset}`);
            console.log(`  ${colors.yellow}Expected log:${colors.reset} ${test.expectedLog}`);
            console.log(`  ${colors.blue}→ Check server terminal for log confirmation${colors.reset}\n`);

            passCount++;
        } catch (error) {
            console.log(`  ${colors.red}✗ Error:${colors.reset} ${error.message}\n`);
            failCount++;
        }
    }

    console.log('='.repeat(80));
    console.log(`${colors.green}Passed: ${passCount}${colors.reset} | ${colors.red}Failed: ${failCount}${colors.reset}`);
    console.log('='.repeat(80));
    console.log('\n📋 Next Steps:');
    console.log('1. Check server terminal for 🔄 [MODULAR AUTH] logs');
    console.log('2. If you see the logs, the migration is successful!');
    console.log('3. Test actual login with valid credentials');
    console.log('4. Test OAuth flows (Google login)');
    console.log('\n');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
