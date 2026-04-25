const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testMessageRoutes() {
    console.log('🧪 Testing Message Routes Canonicalization...\n');

    const tests = [
        {
            name: 'Send DM',
            method: 'POST',
            endpoint: '/messages/dm/send',
            data: { ciphertext: 'test', messageIv: 'test', isEncrypted: true },
            expectedStatus: 401, 
            expectLog: 'sendDirectMessage'
        },
        {
            name: 'Get DMs',
            method: 'GET',
            endpoint: '/messages/dm/workspace123/session123',
            expectedStatus: 401,
            expectLog: 'getDMs'
        },
        {
            name: 'Resolve DM Session',
            method: 'GET',
            endpoint: '/messages/workspace/workspace123/dm/resolve/user123',
            expectedStatus: 401,
            expectLog: 'resolveDMSession'
        },
        {
            name: 'Get Workspace DM List',
            method: 'GET',
            endpoint: '/messages/workspace/workspace123/dms',
            expectedStatus: 401,
            expectLog: 'getWorkspaceDMList'
        },
        {
            name: 'Send Channel Message',
            method: 'POST',
            endpoint: '/messages/channel/send',
            data: { ciphertext: 'test', messageIv: 'test', isEncrypted: true },
            expectedStatus: 401,
            expectLog: 'sendChannelMessage'
        },
        {
            name: 'Get Channel Messages',
            method: 'GET',
            endpoint: '/messages/channel/channel123',
            expectedStatus: 401,
            expectLog: 'getChannelMessages'
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
                validateStatus: () => true 
            };

            const response = await axios(config);

            const statusMatches = response.status === test.expectedStatus;

            if (statusMatches) {
                console.log(`✅ ${test.name}: Status ${response.status} (Expected ${test.expectedStatus})`);
                if (test.expectLog) {
                    console.log(`   📝 Expected log: 🔄 [MESSAGES:MODULAR] Function invoked: ${test.expectLog}`);
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
        console.log('1. Check server terminal for verification logs with prefix: 🔄 [MESSAGES:MODULAR]');
        console.log('2. Perform manual testing with authenticated requests');
        console.log('3. Test DM flows: resolve session, send DM, fetch DMs');
        console.log('4. Test channel message flows: send, fetch');
        console.log('5. Test thread operations (out of scope, but verify not broken)');
        console.log('6. Verify socket events still fire correctly');
    } else {
        console.log('❌ Some tests failed. Please check the server logs.');
    }
}

testMessageRoutes().catch(console.error);
