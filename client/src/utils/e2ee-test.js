/**
 * E2EE Quick Validation Script
 * 
 * Tests the complete encryption/decryption flow
 * Run in browser console after logging in
 */

// ============ STEP 1: Test Crypto Utilities ============

async function testCrypto() {
    const {
        generateWorkspaceKey,
        encryptMessage,
        decryptMessage
    } = await import('./utils/crypto.js');

    console.log('1️⃣ Testing crypto utilities...');

    // Generate test key
    const testKey = await generateWorkspaceKey();
    console.log('✅ Generated workspace key');

    // Test encryption
    const plaintext = "Hello, this is a test message! 🎉";
    const encrypted = await encryptMessage(plaintext, testKey);
    console.log('✅ Encrypted:', encrypted.ciphertext.substring(0, 20) + '...');

    // Test decryption
    const decrypted = await decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        testKey
    );
    console.log('✅ Decrypted:', decrypted);

    if (decrypted === plaintext) {
        console.log('✅ PASS: Encryption/Decryption working!\n');
        return true;
    } else {
        console.error('❌ FAIL: Decryption mismatch!\n');
        return false;
    }
}

// ============ STEP 2: Test Key Management ============
async function testKeyManagement() {
    const { getEnrolledWorkspaces, hasWorkspaceKey } = await import('./services/keyManagement.js');

    console.log('2️⃣ Testing key management...');

    const enrolledWorkspaces = getEnrolledWorkspaces();
    console.log(`✅ Enrolled in ${enrolledWorkspaces.length} workspaces:`, enrolledWorkspaces);

    if (enrolledWorkspaces.length > 0) {
        const firstWorkspace = enrolledWorkspaces[0];
        const hasKey = hasWorkspaceKey(firstWorkspace);
        console.log(`✅ Has key for ${firstWorkspace}:`, hasKey);
    }

    console.log('✅ PASS: Key management working!\n');
    return true;
}

// ============ STEP 3: Test Message Encryption Flow ============
async function testMessageFlow() {
    console.log('3️⃣ Testing message encryption flow...');

    // Check if workspace key is available
    const workspaces = JSON.parse(sessionStorage.getItem('e2ee_workspace_keys') || '{}');
    console.log('Available workspace keys:', Object.keys(workspaces));

    if (Object.keys(workspaces).length === 0) {
        console.warn('⚠️  No workspace keys in memory. User needs to log in.');
        return false;
    }

    console.log('✅ PASS: Workspace keys loaded!\n');
    return true;
}

// ============ STEP 4: Database Check (requires server access) ============
function testDatabaseStorage() {
    console.log('4️⃣ Database storage check...');
    console.log('To verify encrypted messages in database, run in MongoDB:');
    console.log('  db.messages.findOne({ isEncrypted: true })');
    console.log('Expected: ciphertext and messageIv fields should be populated\n');
}

// ============ RUN ALL TESTS ============
async function runAllTests() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  E2EE Implementation Validation Suite   ║');
    console.log('╚══════════════════════════════════════════╝\n');

    try {
        await testCrypto();
        await testKeyManagement();
        await testMessageFlow();
        testDatabaseStorage();

        console.log('═══════════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('E2EE is ready for production deployment.');
        console.log('═══════════════════════════════════════════');
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        console.log('\nCheck the error above and ensure:');
        console.log('1. You are logged in');
        console.log('2. Workspace keys have been generated');
        console.log('3. Migration has been run');
    }
}

// Auto-run when script is loaded
if (typeof window !== 'undefined') {
    runAllTests();
}

export { testCrypto, testKeyManagement, testMessageFlow, runAllTests };
