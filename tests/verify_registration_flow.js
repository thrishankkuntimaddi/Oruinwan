const TEST_COMPANY = {
    companyName: `Test Corp ${Date.now()}`,
    adminName: 'Test Admin',
    adminEmail: `admin${Date.now()}@testcorp.com`,
    adminPassword: 'password123',
    documents: [],
    departments: ['Engineering', 'Sales'],
    workspaceName: 'Test HQ',
    defaultChannels: ['general', 'random']
};

const BASE_URL = 'http://localhost:5000/api';
let accessToken = null;

async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    // Handle 204 or empty responses
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    return { status: res.status, data };
}

async function runTest() {
    console.log("🚀 Starting Full Lifecycle Verification...");

    let companyId;
    let userId;

    // 1. Register Company
    console.log("\n1️⃣  Registering Company...");
    try {
        const { status, data } = await request('POST', `${BASE_URL}/companies/register`, TEST_COMPANY);
        console.log("   Response:", status, data.message);

        if (status !== 201) throw new Error(`Registration failed: ${status}`);
        if (data.status !== 'pending_verification') throw new Error(`Expected pending_verification, got ${data.status}`);

        companyId = data.company.id;
        console.log(`   ✅ Company Created: ${companyId}`);

    } catch (err) {
        console.error("❌ Registration Failed:", err.message);
        process.exit(1);
    }

    // 2. Verify Company (Internal)
    console.log(`\n2️⃣  Verifying Company (Internal API)...`);
    try {
        const { status, data } = await request('POST', `${BASE_URL}/companies/${companyId}/verify`, {
            decision: 'approve'
        });
        console.log("   Response:", status, data.status);

        if (data.status !== 'verified') throw new Error("Expected status 'verified'");
        console.log("   ✅ Company Verified!");

    } catch (err) {
        console.error("❌ Verification Failed:", err.message);
        process.exit(1);
    }

    // 3. Login as Admin (First Time)
    console.log(`\n3️⃣  Logging in as Admin (First Time)...`);
    try {
        const { status, data } = await request('POST', `${BASE_URL}/auth/login`, {
            email: TEST_COMPANY.adminEmail,
            password: TEST_COMPANY.adminPassword
        });

        if (status !== 200) throw new Error(`Login failed: ${status}`);

        accessToken = data.accessToken;
        userId = data.user.id;

        console.log(`   ✅ Logged in as ${data.user.email}`);
        console.log(`   ℹ️  isSetupComplete: ${data.company.isSetupComplete}`);
        console.log(`   ℹ️  setupStep: ${data.company.setupStep}`);

        if (data.company.isSetupComplete) throw new Error("Expected isSetupComplete: false");

    } catch (err) {
        console.error("❌ Login Failed:", err.message);
        process.exit(1);
    }

    // 4. Run Setup Wizard Steps
    console.log(`\n4️⃣  Running Setup Wizard...`);
    try {
        // Step 1: Profile
        console.log("   🔹 Step 1: Profile...");
        let res = await request('PUT', `${BASE_URL}/companies/${companyId}/setup`, {
            step: 1,
            data: { displayName: "Test Corp Updated" }
        });
        if (res.data.step !== 1) throw new Error("Step 1 failed");

        // Step 2: Departments
        console.log("   🔹 Step 2: Departments...");
        res = await request('PUT', `${BASE_URL}/companies/${companyId}/setup`, {
            step: 2,
            data: { departments: ["HR", "Legal"] }
        });
        if (res.data.step !== 2) throw new Error("Step 2 failed");

        // Step 3: Invites
        console.log("   🔹 Step 3: Invites...");
        res = await request('PUT', `${BASE_URL}/companies/${companyId}/setup`, {
            step: 3,
            data: { invites: [] }
        });
        if (res.data.step !== 3) throw new Error("Step 3 failed");

        // Step 4: Complete
        console.log("   🔹 Step 4: Completion...");
        res = await request('PUT', `${BASE_URL}/companies/${companyId}/setup`, {
            step: 4,
            data: {}
        });

        if (!res.data.isSetupComplete) throw new Error("Expected isSetupComplete: true");
        console.log("   ✅ Setup Complete!");

    } catch (err) {
        console.error("❌ Setup Failed:", err.message);
        process.exit(1);
    }

    // 5. Verify Login Again
    console.log(`\n5️⃣  Verifying Final State...`);
    try {
        const { status, data } = await request('POST', `${BASE_URL}/auth/login`, {
            email: TEST_COMPANY.adminEmail,
            password: TEST_COMPANY.adminPassword
        });

        console.log(`   ℹ️  isSetupComplete: ${data.company.isSetupComplete}`);

        if (!data.company.isSetupComplete) throw new Error("Final check failed: isSetupComplete is false");

        console.log("   ✅ Final State Verified.");

    } catch (err) {
        console.error("❌ Final Check Failed:", err.message);
        process.exit(1);
    }

    console.log("\n🎉 Full Lifecycle Test Passed!");
}

runTest();
