/**
 * Verification script for Channel Routes Canonicalization
 * Tests that routes are now using the modular channel controller
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testChannelRoutes() {
    console.log('🧪 Testing Channel Routes Canonicalization...\n');

    const tests = [
        {
            name: 'Get My Channels',
            method: 'GET',
            endpoint: '/channels/my?workspaceId=test',
            expectedStatus: 401, // No auth token
            expectLog: false
        },
        {
            name: 'Create Channel (without auth)',
            method: 'POST',
            endpoint: '/channels',
            data: { name: 'test-channel' },
            expectedStatus: 401,
            expectLog: 'createChannel'
        },
        {
            name: 'Join Channel (without auth)',
            method: 'POST',
            endpoint: '/channels/123/join',
            expectedStatus: 401,
            expectLog: 'joinChannel'
        },
        {
            name: 'Update Channel (without auth)',
            method: 'PUT',
            endpoint: '/channels/123',
            data: { name: 'updated' },
            expectedStatus: 401,
            expectLog: 'updateChannel'
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const config = {
                method: test.method,
                url: `${BASE_URL}${test.endpoint}`,
                data: test.data,
                validateStatus: () => true // Don't throw on any status
            };

            const response = await axios(config);

            const statusMatches = response.status === test.expectedStatus;

            if (statusMatches) {
                console.log(`✅ ${test.name}: Status ${response.status} (Expected ${test.expectedStatus})`);
                if (test.expectLog) {
                    console.log(`   📝 Expected log: 🔄 [CHANNEL:MODULAR] Function invoked: ${test.expectLog}`);
                }
                passed++;
            } else {
                console.log(`❌ ${test.name}: Status ${response.status} (Expected ${test.expectedStatus})`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name}: Error - ${error.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('✅ All route accessibility tests passed!');
        console.log('\n📋 Next Steps:');
        console.log('1. Check server terminal for verification logs with prefix: 🔄 [CHANNEL:MODULAR]');
        console.log('2. Perform manual testing with authenticated requests');
        console.log('3. Test channel create, join, leave, invite, remove flows');
        console.log('4. Verify socket events still fire correctly');
    } else {
        console.log('❌ Some tests failed. Please check the server logs.');
    }
}

testChannelRoutes().catch(console.error);
